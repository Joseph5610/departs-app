
import { Env, AppVehicleCollection, AppCityStats } from "../../../../_core/types";

import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GolemioClient } from "../../core/GolemioClient";
import { VehiclesMapper } from "./VehiclesMapper";
import { golemioVehiclePayloadSchema, type GolemioVehiclePayload } from "./schemas";
import { vehicleQuerySchema, parseSearchParams } from "../../../../_core/schemas";
import { aggregateCityStats } from "../../../../_core/utils/statsAggregator";

/**
 * Service for fetching real-time positions of active transit vehicles.
 */
export class VehiclesService {
    constructor(private client: GolemioClient) {}

    /**
     * Fetches raw vehicle positions directly from Golemio API.
     * Used for debug feeds and as base data for getVehicles.
     */
    async getRawVehicles(env: Env, params: Record<string, string | string[]> = {}) {
        const response = await this.client.fetch("/v2/public/vehiclepositions", env, {
            searchParams: params,
            cacheTtl: CACHE_TTL.VEHICLES
        });

        if (!response.ok) {
            console.error(`Golemio returned ${response.status} for vehicles feed.`);
            throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        return await response.json();
    }

    /**
     * Fetches real-time positions of all active transit vehicles within given map bounds.
     * Includes normalization of route types, colors, and night route flags.
     * 
     * @param {Env} env - The environment configuration
     * @param {URLSearchParams} searchParams - The query parameters containing map bounds and filters
     * @returns {Promise<AppVehicleCollection>} Feature collection of active vehicles
     */
    async getVehicles(env: Env, searchParams: URLSearchParams): Promise<AppVehicleCollection> {
        const { bounds, routeType: routeTypes, routeShortName: routeShortNames } = parseSearchParams(searchParams, vehicleQuerySchema);

        const params: Record<string, string | string[]> = {};
            if (bounds) params.boundingBox = bounds;
            if (routeTypes.length > 0) params.routeType = routeTypes;
            if (routeShortNames.length > 0) params.routeShortName = routeShortNames;

            let rawData;
            try {
                rawData = await this.getRawVehicles(env, params);
            } catch (error) {
                console.error(`Golemio vehicles feed is down`, error);
                return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
            }
            const parsed = golemioVehiclePayloadSchema.safeParse(rawData);
            
            if (!parsed.success) {
                console.error("Critical Golemio vehicles structural change:", parsed.error);
                return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
            }
            
            const data = parsed.data;
            if (data.features) {
                data.features = data.features.filter((f): f is NonNullable<typeof f> => f !== null);
            }

            return VehiclesMapper.map(data as GolemioVehiclePayload);
    }

    /**
     * Fetches all raw vehicles and computes global network statistics.
     */
    async getStats(env: Env): Promise<AppCityStats> {
        let rawData;
        try {
            rawData = await this.getRawVehicles(env, {});
        } catch (error) {
            console.error(`Golemio vehicles feed is down`, error);
            throw new ApiError(ERROR_MESSAGES.VEHICLES_DATA_UNAVAILABLE, 503, { cause: error });
        }
        
        const parsed = golemioVehiclePayloadSchema.safeParse(rawData);
        if (!parsed.success) {
            throw new ApiError(ERROR_MESSAGES.DATA_STRUCTURE_CHANGED, 500);
        }

        const data = parsed.data;
        if (data.features) {
            data.features = data.features.filter((f): f is NonNullable<typeof f> => f !== null);
        }

        const mappedCollection = VehiclesMapper.map(data as GolemioVehiclePayload);
        
        return aggregateCityStats(mappedCollection.features);
    }
}
