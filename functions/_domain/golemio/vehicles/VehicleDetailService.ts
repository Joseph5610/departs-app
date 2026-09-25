import type { AppVehicleDetail, CityRequestContext } from "../../../_core/types";
import type { VehicleDetailUseCase } from "../../use-cases";

import { ERROR_MESSAGES } from "../../../_core/config";
import { ApiError } from "../../../_core/errors";
import { getTripDetail } from "../../../_feeds/golemio/vehicle-detail";
import { VehicleDetailMapper } from "./VehicleDetailMapper";
import { vehicleDetailQuerySchema, parseSearchParams } from "../../../_core/schemas";
import { attachTripConnections } from "../connections/connections";
import { getLiveConnections } from "../../../_feeds/golemio/connections";
import { getLocalClock } from "../../../_core/utils/time";
import { GOLEMIO_CONFIG } from "../../../_feeds/golemio/config";

/**
 * Service for fetching detailed information about a specific transit vehicle or trip.
 * Supports both real-time active vehicle details and static GTFS schedule fallbacks.
 */
export class VehicleDetailService implements VehicleDetailUseCase {
    /**
     * Fetches detailed data for a specific vehicle or trip, including its real-time position
     * and upcoming stop times. Falls back to static schedule if real-time fails.
     * 
     * @returns {Promise<AppVehicleDetail>} Comprehensive vehicle and route details
     * @throws {ApiError} If tripId is missing or upstream fetch fails
     */
    async getVehicleDetail(ctx: CityRequestContext): Promise<AppVehicleDetail> {
        // Started, not awaited - see the note in DeparturesService: this is independent of the trip
        // fetch below and only needs to be resolved at the mapping step.
        const connectionsPromise = getLiveConnections();
        const { vehicleId: rawVehicleId, tripId: rawTripId } = parseSearchParams(ctx.url.searchParams, vehicleDetailQuerySchema);
        
        const vehicleId = rawVehicleId ?? null;
        const tripId = rawTripId ?? null;

        if (!tripId) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

        const { data, isStatic } = await getTripDetail(ctx.env, tripId, vehicleId);

        const detail = VehicleDetailMapper.map(data, tripId, vehicleId, isStatic);
        attachTripConnections(
            detail,
            await connectionsPromise,
            getLocalClock(GOLEMIO_CONFIG.TIMEZONE)
        );
        return detail;
    }
}
