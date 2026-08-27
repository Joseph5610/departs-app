
import { Env, AppVehicleCollection, AppCityStats } from "../../../../_core/types";

import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { CacheManager } from "../../../../_core/utils/CacheManager";
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
     * Fetches the entire vehicle feed from Golemio, parses, and maps it.
     * Caches the mapped collection using CacheManager to prevent CPU limit
     * exceeded (503) errors during concurrent map movements.
     */
    async getCachedMappedVehicles(env: Env): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            `golemio_vehicles_collection`,
            5000, // SHORT_DEBOUNCE_MS
            async () => {
                let rawData;
                try {
                    rawData = await this.getRawVehicles(env, {});
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
            },
            (col) => !col || col.status === 'upstream_offline' || !col.features || col.features.length === 0
        );
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

        const allVehicles = await this.getCachedMappedVehicles(env);
        let filtered = allVehicles.features;

        if (routeTypes && routeTypes.length > 0) {
            const allowedTypes = new Set(routeTypes.map(r => r.toLowerCase()));
            filtered = filtered.filter(f => allowedTypes.has(f.properties.route_type));
        }

        if (routeShortNames && routeShortNames.length > 0) {
            const allowedNames = new Set(routeShortNames.map(r => r.toUpperCase()));
            filtered = filtered.filter(f => allowedNames.has(f.properties.route_short_name.toString().toUpperCase()));
        }

        if (bounds) {
            const [minLat, minLng, maxLat, maxLng] = bounds.split(',').map(Number);
            filtered = filtered.filter(f => {
                if (!f.geometry || !f.geometry.coordinates) return false;
                const [lng, lat] = f.geometry.coordinates;
                return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
            });
        }

        return {
            type: 'FeatureCollection',
            features: filtered,
            status: allVehicles.status,
            last_updated: allVehicles.last_updated
        };
    }

    /**
     * Fetches all raw vehicles and computes global network statistics.
     */
    async getStats(env: Env): Promise<AppCityStats> {
        const allVehicles = await this.getCachedMappedVehicles(env);
        if (allVehicles.status === 'upstream_offline') {
            throw new ApiError(ERROR_MESSAGES.VEHICLES_DATA_UNAVAILABLE, 503);
        }
        
        return aggregateCityStats(allVehicles.features);
    }
}
