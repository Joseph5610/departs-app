import type { EventContext } from "@cloudflare/workers-types";
import type { CityConfig } from '../../_core/city-config';
import { GtfsAdapter } from '../gtfs/GtfsAdapter';
import type { Env, AppVehicleCollection, AppVehicleDetail, AppVehicleFeature } from "../../_core/types";
import { KordisVehiclesService } from './services/KordisVehiclesService';
import { addSecondsToTime } from '../gtfs/core/utils';
import { getDpmbVehicleMetadata } from './utils/dpmbVehicleMetadata';

export class KordisAdapter extends GtfsAdapter {
    private vehiclesService: KordisVehiclesService;

    constructor(protected readonly city: CityConfig) {
        super(city);
        this.vehiclesService = new KordisVehiclesService(city);
    }

    async handleVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        return this.vehiclesService.getFilteredVehicles(ctx);
    }

    async handleVehicleDetail(ctx: EventContext<Env, string, unknown>) {
        const detail = await super.handleVehicleDetail(ctx);

        if (!detail || detail.vehicle_id === 'error') {
            return detail;
        }

        // Apply static vehicle metadata by default
        if (detail.vehicle_id) {
            const meta = getDpmbVehicleMetadata(detail.vehicle_id);
            if (meta) {
                detail.vehicle_descriptor = {
                    ...detail.vehicle_descriptor,
                    vehicle_type: meta.vehicle_type,
                    is_air_conditioned: meta.is_air_conditioned !== undefined ? meta.is_air_conditioned : detail.vehicle_descriptor?.is_air_conditioned
                };
            }
        }

        // Only ONE lookup for the specific vehicle is made, which internally handles raw ArcGIS parsing.
        const { liveMatch, lastStopId } = await this.vehiclesService.getSingleLiveVehicle(
            detail.vehicle_id || '', 
            detail.gtfs_trip_id
        );

        if (liveMatch) {
            this.enrichVehicleDetail(detail, liveMatch, lastStopId);
        }

        return detail;
    }

    private enrichVehicleDetail(detail: AppVehicleDetail, liveMatch: AppVehicleFeature, lastStopId?: string) {
        // 1. Transfer Core Live Properties
        detail.vehicle_id = liveMatch.properties.vehicle_id || detail.vehicle_id;
        detail.delay = liveMatch.properties.delay;
        detail.state_position = liveMatch.properties.state_position;
        detail.bearing = liveMatch.properties.bearing;
        detail.origin_timestamp = liveMatch.properties.origin_timestamp;
        detail.run_number = liveMatch.properties.run_number;
        
        // 2. Transfer Descriptor
        if (liveMatch.properties.vehicle_descriptor) {
            detail.vehicle_descriptor = {
                ...detail.vehicle_descriptor,
                vehicle_registration_number: liveMatch.properties.vehicle_descriptor.vehicle_registration_number || detail.vehicle_id || undefined,
                is_wheelchair_accessible: liveMatch.properties.vehicle_descriptor.is_wheelchair_accessible ?? detail.vehicle_descriptor?.is_wheelchair_accessible
            };
        }

        // 3. Resolve Last Stop Sequence
        if (lastStopId && detail.stop_times?.features) {
            const stopMatch = detail.stop_times.features.find(s => {
                const sid = s.properties.stop_id;
                return sid === lastStopId || sid.includes(`U${lastStopId}Z`) || sid.startsWith(lastStopId);
            });
            if (stopMatch) {
                detail.last_stop_sequence = stopMatch.properties.stop_sequence;
            }
        }

        // 5. Propagate Delays to Subsequent Stops
        if (typeof detail.delay === 'number' && detail.stop_times?.features) {
            detail.stop_times.features.forEach(f => {
                if (f.properties.stop_sequence >= (detail.last_stop_sequence || 0)) {
                    f.properties.realtime_arrival_time = addSecondsToTime(f.properties.arrival_time, detail.delay) || f.properties.arrival_time;
                    f.properties.realtime_departure_time = addSecondsToTime(f.properties.departure_time, detail.delay) || f.properties.departure_time;
                }
            });
        }

        detail.is_static_fallback = false;
    }
}
