import type { AppVehicleDetail, CityRequestContext } from "../../../_core/types";
import type { VehicleDetailUseCase } from "../../useCases";

import { ERROR_MESSAGES } from "../../../_core/config";
import { ApiError } from "../../../_core/errors";
import { getTripDetail } from "../../../_feeds/golemio/vehicleDetail";
import { mapGolemioVehicleDetail } from "./golemioVehicleDetailMapper";
import { vehicleDetailQuerySchema, parseSearchParams } from "../../../_core/schemas";
import { attachTripConnections } from "../connections/connections";
import { getLiveConnections } from "../../../_feeds/golemio/connections";
import { getTripStopIds } from "../../../_feeds/golemio/tripStopIds";
import { getLocalClock } from "../../../_core/utils/time";
import { GOLEMIO_CONFIG } from "../../../_feeds/golemio/config";

/**
 * Service for fetching detailed information about a specific transit vehicle or trip.
 * Supports both real-time active vehicle details and static GTFS schedule fallbacks.
 */
export class GolemioVehicleDetailService implements VehicleDetailUseCase {
    /**
     * Fetches detailed data for a specific vehicle or trip, including its real-time position
     * and upcoming stop times. Falls back to static schedule if real-time fails.
     * 
     * @returns {Promise<AppVehicleDetail>} Comprehensive vehicle and route details
     * @throws {ApiError} If tripId is missing or upstream fetch fails
     */
    async getVehicleDetail(ctx: CityRequestContext): Promise<AppVehicleDetail> {
        const { vehicleId: rawVehicleId, tripId: rawTripId } = parseSearchParams(ctx.url.searchParams, vehicleDetailQuerySchema);
        
        const vehicleId = rawVehicleId ?? null;
        const tripId = rawTripId ?? null;

        if (!tripId) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

        // Started, not awaited: independent of the trip fetch and only needed at the mapping step.
        const connectionsPromise = getLiveConnections([tripId]);
        const stopIdsPromise = getTripStopIds(ctx.env, tripId);
        const { data, isStatic } = await getTripDetail(ctx.env, tripId, vehicleId);

        const detail = mapGolemioVehicleDetail(data, tripId, vehicleId, isStatic);
        const stopIds = await stopIdsPromise;
        for (const f of detail.stop_times?.features ?? []) {
            if (!f.properties.stop_id) f.properties.stop_id = stopIds.get(f.properties.stop_sequence) ?? '';
        }
        attachTripConnections(
            detail,
            await connectionsPromise,
            getLocalClock(GOLEMIO_CONFIG.TIMEZONE)
        );
        return detail;
    }
}
