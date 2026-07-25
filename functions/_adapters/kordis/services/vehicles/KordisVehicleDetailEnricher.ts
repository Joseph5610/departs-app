import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleDetail, AppVehicleFeature } from "../../../../_core/types";
import { GtfsRtVehicleDetailEnricher } from "../../../gtfs/services/vehicles/GtfsRtVehicleDetailEnricher";
import type { VehiclesService } from "../../../gtfs/services/vehicles/VehiclesService";

import { getDpmbVehicleMetadata } from "../../utils/dpmbVehicleMetadata";

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

    async enrich(detail: AppVehicleDetail, ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        // Use the base GtfsRtEnricher logic (which calls vehiclesService.getSingleLiveVehicle)
        // This might discover the real vehicle_id if it was missing but gtfsTripId was provided.
        const enrichedDetail = await super.enrich(detail, ctx);

        // Apply static vehicle metadata for Brno (DPMB)
        // We do this AFTER the live match so we have the most accurate vehicle_id
        if (enrichedDetail.vehicle_id) {
            const meta = await getDpmbVehicleMetadata(enrichedDetail.vehicle_id);
            if (meta) {
                enrichedDetail.vehicle_descriptor = {
                    ...enrichedDetail.vehicle_descriptor,
                    vehicle_type: meta.vehicle_type,
                    is_air_conditioned: meta.is_air_conditioned !== undefined ? meta.is_air_conditioned : enrichedDetail.vehicle_descriptor?.is_air_conditioned
                };
            }
        }

        enrichedDetail.vehicle_descriptor = {
            ...enrichedDetail.vehicle_descriptor,
            operator: 'IDS JMK',
            vehicle_registration_number: enrichedDetail.vehicle_descriptor?.vehicle_registration_number || ''
        };

        return enrichedDetail;
    }

    protected override enrichVehicleDetail(detail: AppVehicleDetail, liveMatch: AppVehicleFeature, lastStopId?: string) {
        super.enrichVehicleDetail(detail, liveMatch, lastStopId);
    }

    protected normalizeGtfsRtStopId(stopId: string): string {
        // Normalize GTFS-RT stopIds like "U01611Z01" to "U1611Z1" for Brno
        if (stopId.startsWith('U')) {
            return stopId.replace(/U0*(\d+)/, 'U$1').replace(/Z0*(\d+)/, 'Z$1');
        }
        return stopId;
    }
}
