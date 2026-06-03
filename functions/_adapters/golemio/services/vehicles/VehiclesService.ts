
import { Env, AppVehicleCollection } from "../../../../_core/types";
import { GolemioVehiclePayload } from "./types";
import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GolemioClient } from "../../core/GolemioClient";
import { VehiclesMapper } from "./VehiclesMapper";

/**
 * Service for fetching real-time positions of active transit vehicles.
 */
export class VehiclesService {
    constructor(private client: GolemioClient) {}

    /**
     * Fetches real-time positions of all active transit vehicles within given map bounds.
     * Includes normalization of route types, colors, and night route flags.
     * 
     * @param {Env} env - The environment configuration
     * @param {URLSearchParams} searchParams - The query parameters containing map bounds and filters
     * @returns {Promise<AppVehicleCollection>} Feature collection of active vehicles
     */
    async getVehicles(env: Env, searchParams: URLSearchParams): Promise<AppVehicleCollection> {

        const bounds = searchParams.get("bounds");
        const routeTypes = searchParams.getAll("routeType");
        const routeShortNames = searchParams.getAll("routeShortName");

        if (!bounds && routeShortNames.length === 0 && routeTypes.length === 0) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

            const params: Record<string, string | string[]> = {};
            if (bounds) params.boundingBox = bounds;
            if (routeTypes.length > 0) params.routeType = routeTypes;
            if (routeShortNames.length > 0) params.routeShortName = routeShortNames;

            const response = await this.client.fetch("/v2/public/vehiclepositions", env, {
                searchParams: params,
                cacheTtl: CACHE_TTL.VEHICLES
            });

            if (!response.ok) {
                throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), 502);
            }

            const data = await response.json() as GolemioVehiclePayload;
            return VehiclesMapper.map(data);
    }
}
