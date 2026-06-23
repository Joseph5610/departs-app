import { AppVehicleDetail, Env } from "../../../../_core/types";

import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GolemioClient } from "../../core/GolemioClient";
import { VehicleDetailMapper } from "./VehicleDetailMapper";
import { golemioVehiclePayloadSchema, type GolemioVehiclePayload } from "./schemas";
import { vehicleDetailQuerySchema, parseSearchParams } from "../../../../_core/schemas";

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
        const { vehicleId: rawVehicleId, tripId: rawTripId } = parseSearchParams(searchParams, vehicleDetailQuerySchema);
        
        const vehicleId = rawVehicleId ?? null;
        const tripId = rawTripId ?? null;

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

        const rawData = await response.json();
        const parsed = golemioVehiclePayloadSchema.safeParse(rawData);

        if (!parsed.success) {
            console.error(`Critical Golemio vehicle detail structural change for ${tripId}:`, parsed.error);
            throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(502), 502);
        }

        const data = parsed.data as GolemioVehiclePayload;
        if (data.features) {
            data.features = data.features.filter((f): f is NonNullable<typeof f> => f !== null);
        }
        if (data.stop_times && data.stop_times.features) {
            data.stop_times.features = data.stop_times.features.filter((f): f is NonNullable<typeof f> => f !== null);
        }

        return VehicleDetailMapper.map(data, tripId, vehicleId, isStatic);
    }
}
