import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleDetail } from "../../../../_core/types";
import { GtfsRtVehicleDetailEnricher } from "../../../gtfs/services/vehicles/GtfsRtVehicleDetailEnricher";
import type { VehiclesService } from "../../../gtfs/services/vehicles/VehiclesService";
import { getDpmbVehicleRanges, findDpmbRange } from "../../utils/dpmbVehicleMetadata";

/**
 * Brno-specific vehicle enricher.
 * Injects local static metadata (e.g., DPMB vehicle models, AC status) before
 * delegating live GPS/delay enrichment either to the standard GTFS-RT feed.
 */
export class KordisVehicleDetailEnricher extends GtfsRtVehicleDetailEnricher {
    constructor(
        protected vehiclesService: VehiclesService
    ) {
        super(vehiclesService);
    }

    async enrich(detail: AppVehicleDetail, _ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        // Use the base GtfsRtEnricher logic (which calls vehiclesService.getSingleLiveVehicle)
        // This might discover the real vehicle_id if it was missing but gtfsTripId was provided.
        const enrichedDetail = await super.enrich(detail, _ctx);

        // Apply static vehicle metadata for Brno (DPMB)
        let operator = 'IDS JMK';
        
        // If the live match already enriched this with DPMB metadata
        if (enrichedDetail.vehicle_descriptor?.vehicle_type) {
            operator = 'DPMB';
        } else if (enrichedDetail.vehicle_id) {
            // Fallback for offline vehicles where we only have the ID and no live match
            const num = parseInt(enrichedDetail.vehicle_id, 10);
            if (!isNaN(num)) {
                const ranges = await getDpmbVehicleRanges();
                if (ranges) {
                    const rangeMatch = findDpmbRange(num, ranges);
                    if (rangeMatch) {
                        operator = 'DPMB';
                        enrichedDetail.vehicle_descriptor = {
                            ...enrichedDetail.vehicle_descriptor,
                            vehicle_type: rangeMatch.vehicle_type,
                            is_air_conditioned: rangeMatch.is_air_conditioned !== undefined ? rangeMatch.is_air_conditioned : enrichedDetail.vehicle_descriptor?.is_air_conditioned
                        };
                    }
                }
            }
        }

        enrichedDetail.vehicle_descriptor = {
            ...enrichedDetail.vehicle_descriptor,
            operator,
            vehicle_registration_number: enrichedDetail.vehicle_descriptor?.vehicle_registration_number || ''
        };

        return enrichedDetail;
    }

    protected override normalizeStopId(stopId: string): string {
        // Normalize GTFS-RT stopIds like "U01611Z01" to "U1611Z1" for Brno
        return stopId.replace(/U0*(\d+)/i, 'U$1').replace(/Z0*(\d+)/i, 'Z$1');
    }
}
