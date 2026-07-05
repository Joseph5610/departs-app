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
        return this.vehiclesService.getVehicles(ctx);
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

        const liveVehicles = await this.vehiclesService.getAllVehicles();
        const liveMatch = liveVehicles.features.find(f => {
            if (detail.vehicle_id && f.properties.vehicle_id === detail.vehicle_id) return true;
            if (detail.gtfs_trip_id && f.properties.gtfs_trip_id === detail.gtfs_trip_id) return true;
            return false;
        });

        if (liveMatch) {
            this.transferLiveProperties(detail, liveMatch);
            this.injectGeoJsonColors(detail, liveMatch.properties.route_color);
            await this.resolveLastStopSequence(ctx, detail);
            this.propagateDelaysToStops(detail);
            
            detail.is_static_fallback = false;
        }

        return detail;
    }

    private transferLiveProperties(detail: AppVehicleDetail, liveMatch: AppVehicleFeature) {
        if (!detail.vehicle_id && liveMatch.properties.vehicle_id) {
            detail.vehicle_id = liveMatch.properties.vehicle_id;
        }

        detail.delay = liveMatch.properties.delay;
        detail.state_position = liveMatch.properties.state_position;
        detail.bearing = liveMatch.properties.bearing;
        detail.origin_timestamp = liveMatch.properties.origin_timestamp;
        detail.run_number = liveMatch.properties.run_number;
        
        if (liveMatch.properties.route_color) {
            detail.route_color = liveMatch.properties.route_color;
        }
        if (liveMatch.properties.is_night !== undefined) {
            detail.is_night = liveMatch.properties.is_night;
        }
        if (!detail.route_short_name && liveMatch.properties.route_short_name) {
            detail.route_short_name = liveMatch.properties.route_short_name;
        }
        
        if (liveMatch.properties.vehicle_descriptor) {
            detail.vehicle_descriptor = {
                ...detail.vehicle_descriptor,
                vehicle_registration_number: liveMatch.properties.vehicle_descriptor.vehicle_registration_number || (liveMatch.properties.vehicle_id ?? undefined),
                is_wheelchair_accessible: liveMatch.properties.vehicle_descriptor.is_wheelchair_accessible,
                is_air_conditioned: liveMatch.properties.vehicle_descriptor.is_air_conditioned !== undefined ? liveMatch.properties.vehicle_descriptor.is_air_conditioned : detail.vehicle_descriptor?.is_air_conditioned,
                vehicle_type: liveMatch.properties.vehicle_descriptor.vehicle_type || detail.vehicle_descriptor?.vehicle_type
            };
        }
    }

    private injectGeoJsonColors(detail: AppVehicleDetail, color: string | undefined) {
        if (color && detail.route_geojson?.features) {
            detail.route_geojson.features.forEach(f => {
                f.properties = f.properties || {};
                f.properties.route_color = color;
            });
        }
    }

    private async resolveLastStopSequence(ctx: EventContext<Env, string, unknown>, detail: AppVehicleDetail) {
        const rawArcgisData = await this.vehiclesService.getRawVehicles();
        const targetId = Number(detail.vehicle_id);
        const rawMatch = rawArcgisData.features.find(f => f.attributes.ID === targetId);
        const lastStopId = rawMatch?.attributes?.LastStopID?.toString();

        if (lastStopId && detail.stop_times?.features?.length) {
            const stopMatch = detail.stop_times.features.find(s => {
                const sid = s.properties.stop_id;
                return sid === lastStopId || sid.includes(`U${lastStopId}Z`) || sid.startsWith(lastStopId);
            });
            if (stopMatch) {
                detail.last_stop_sequence = stopMatch.properties.stop_sequence;
            }
        }
    }

    private propagateDelaysToStops(detail: AppVehicleDetail) {
        if (typeof detail.delay === 'number' && detail.stop_times?.features) {
            detail.stop_times.features.forEach(f => {
                if (f.properties.stop_sequence >= (detail.last_stop_sequence || 0)) {
                    f.properties.realtime_arrival_time = addSecondsToTime(f.properties.arrival_time, detail.delay) || f.properties.arrival_time;
                    f.properties.realtime_departure_time = addSecondsToTime(f.properties.departure_time, detail.delay) || f.properties.departure_time;
                }
            });
        }
    }
}
