import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleDetail, AppVehicleFeature } from "../../../../_core/types";
import type { VehicleDetailEnricher } from "./VehicleDetailEnricher";
import type { VehiclesService } from "./VehiclesService";

import { addSecondsToTime } from '../../core/utils';

/**
 * The standard GTFS-RT vehicle enricher.
 * It takes the static timetable and searches the GTFS-RT feed (via VehiclesService)
 * for the live position and delay of the vehicle. It then injects this live data
 * and recalculates all upcoming stop arrival/departure times.
 */
export class GtfsRtVehicleDetailEnricher implements VehicleDetailEnricher {
    constructor(protected vehiclesService: VehiclesService) {}

    async enrich(detail: AppVehicleDetail, ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        void ctx; // ctx is not used in base yet

        if (!detail.vehicle_id && !detail.gtfs_trip_id) {
            return detail;
        }

        const result = await this.vehiclesService.getSingleLiveVehicle(detail.vehicle_id || '', detail.gtfs_trip_id);
        const liveMatch = result.liveMatch;
        const lastStopId = result.lastStopId;

        if (liveMatch) {
            this.enrichVehicleDetail(detail, liveMatch, lastStopId);
        }

        return detail;
    }

    protected enrichVehicleDetail(detail: AppVehicleDetail, liveMatch: AppVehicleFeature, lastStopId?: string) {
        // 1. Transfer Core Live Properties
        detail.vehicle_id = liveMatch.properties.vehicle_id || detail.vehicle_id;
        detail.delay = liveMatch.properties.delay;
        detail.state_position = liveMatch.properties.state_position;
        detail.bearing = liveMatch.properties.bearing;
        detail.origin_timestamp = liveMatch.properties.origin_timestamp;
        detail.run_number = liveMatch.properties.run_number;
        
        if (liveMatch.geometry) {
            detail.geometry = liveMatch.geometry;
        }
        
        // 2. Transfer Descriptor
        if (liveMatch.properties.vehicle_descriptor) {
            detail.vehicle_descriptor = {
                ...detail.vehicle_descriptor,
                ...liveMatch.properties.vehicle_descriptor,
                vehicle_registration_number: liveMatch.properties.vehicle_descriptor.vehicle_registration_number || detail.vehicle_id || undefined,
                is_wheelchair_accessible: liveMatch.properties.vehicle_descriptor.is_wheelchair_accessible ?? detail.vehicle_descriptor?.is_wheelchair_accessible
            };
        }

        // 3. Resolve Last Stop Sequence (Base generic implementation)
        let resolvedSequence: number | null = null;
        if (lastStopId && detail.stop_times?.features) {
            const stopMatch = this.findMatchingStop(detail.stop_times.features, lastStopId);
            
            if (stopMatch) {
                let seq = stopMatch.properties.stop_sequence;
                if (detail.state_position === 'on_track') {
                    seq = Math.max(1, seq - 1);
                }
                resolvedSequence = seq;
            }
        }
        
        detail.last_stop_sequence = resolvedSequence ?? liveMatch.properties.last_stop_sequence ?? undefined;

        // 4. Propagate Delays to Subsequent Stops
        const delay = detail.delay;
        if (typeof delay === 'number' && detail.stop_times?.features) {
            detail.stop_times.features.forEach(f => {
                if (f.properties.stop_sequence >= (detail.last_stop_sequence || 0)) {
                    f.properties.realtime_arrival_time = addSecondsToTime(f.properties.arrival_time, delay) || f.properties.arrival_time;
                    f.properties.realtime_departure_time = addSecondsToTime(f.properties.departure_time, delay) || f.properties.departure_time;
                }
            });
        }

        detail.is_static_fallback = false;
    }

    protected findMatchingStop(
        features: NonNullable<NonNullable<AppVehicleDetail['stop_times']>['features']>,
        lastStopId: string
    ) {
        const cleanId = (id: string) => {
            return id
                .replace(/^centroid-/, '')
                .replace(/U0*(\d+)/i, 'U$1')
                .replace(/Z0*(\d+)/i, 'Z$1');
        };

        const targetClean = cleanId(lastStopId);
        const normalizedTarget = this.normalizeGtfsRtStopId(lastStopId);

        // 1. Direct or clean ID match
        let match = features.find(s => {
            const sid = s.properties.stop_id;
            if (!sid) return false;
            const sClean = cleanId(sid);
            return (
                sid === lastStopId ||
                sid === normalizedTarget ||
                sClean === targetClean
            );
        });

        if (match) return match;

        // 2. Node ID numeric match (e.g. U11006Z01 -> 11006)
        const nodeMatch = lastStopId.match(/U0*(\d+)Z/i) || lastStopId.match(/(\d+)/);
        if (nodeMatch) {
            const nodeId = nodeMatch[1];
            match = features.find(s => {
                const sid = s.properties.stop_id;
                if (!sid) return false;
                const sidNode = sid.match(/U0*(\d+)Z/i) || sid.match(/(\d+)/);
                return sid === nodeId || (sidNode && sidNode[1] === nodeId);
            });
        }

        return match;
    }

    protected normalizeGtfsRtStopId(stopId: string): string {
        return stopId;
    }
}
