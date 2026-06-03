import { AppVehicleDetail, Env } from "../../../../_core/types";
import { GolemioVehiclePayload } from "./types";
import { CACHE_TTL, ERROR_MESSAGES, sanitizeId } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GolemioClient } from "../../core/GolemioClient";
import { VehicleDetailMapper } from "./VehicleDetailMapper";

/**
 * Service for fetching detailed information about a specific transit vehicle or trip.
 * Supports both real-time active vehicle details and static GTFS schedule fallbacks.
 */
export class VehicleDetailService {
    constructor(private client: GolemioClient) {}

    /**
     * Fetches detailed data for a specific vehicle or trip, including its real-time position,
     * shape trajectory, and upcoming stop times. Falls back to static schedule if real-time fails.
     * 
     * @param {Env} env - The environment configuration
     * @param {URLSearchParams} searchParams - The query parameters containing vehicleId and tripId
     * @returns {Promise<AppVehicleDetail>} Comprehensive vehicle and route details
     * @throws {ApiError} If tripId is missing or upstream fetch fails
     */
    async getVehicleDetail(env: Env, searchParams: URLSearchParams): Promise<AppVehicleDetail> {
        const vehicleId = sanitizeId(searchParams.get("vehicleId"));
        const tripId = sanitizeId(searchParams.get("tripId"));

        if (!tripId) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

        const scopes = ['info', 'stop_times', 'shapes', 'vehicle_descriptor'];

        const fetchStaticTrip = async () => {
            const res = await this.client.fetch(`/v2/public/gtfs/trips/${tripId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: { scopes }
            });
            return { response: res, isStatic: true };
        };

        let response: Response;
        let isStatic = false;

        if (!vehicleId) {
            ({ response, isStatic } = await fetchStaticTrip());
        } else {
            response = await this.client.fetch(`/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: { scopes }
            });

            if (!response.ok) {
                console.warn(`Real-time fetch failed (${response.status}), falling back to static GTFS for trip ${tripId}`);
                ({ response, isStatic } = await fetchStaticTrip());
            }
        }

        if (!response.ok) {
            throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data = await response.json() as GolemioVehiclePayload;
        return VehicleDetailMapper.map(data, tripId, isStatic);
    }
}
