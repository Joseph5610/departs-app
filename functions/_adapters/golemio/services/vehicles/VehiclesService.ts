
import { Env, AppVehicleCollection, AppCityStats } from "../../../../_core/types";

import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/config";
import { ApiError } from "../../../../_core/errors";
import { GolemioClient } from "../../core/GolemioClient";
import { getResponseGeneratedAt } from "../../../../_core/ApiClient";
import { CacheManager } from "../../../../_core/utils/CacheManager";
import { VehiclesMapper } from "./VehiclesMapper";
import { golemioVehiclePayloadSchema, type GolemioVehiclePayload } from "./schemas";
import { vehicleQuerySchema, parseSearchParams } from "../../../../_core/schemas";
import { aggregateCityStats } from "../../../../_core/utils/statsAggregator";
import { filterVehicles } from "../../../../_core/utils/vehicleFilter";

/** The whole Prague fleet as last fetched: Golemio's payload and its mapped collection. */
interface Fleet {
    payload: unknown;
    collection: AppVehicleCollection;
}

const OFFLINE_FLEET: Fleet = { payload: null, collection: { type: 'FeatureCollection', features: [], status: 'upstream_offline' } };

/**
 * Service for fetching real-time positions of active transit vehicles.
 *
 * The whole fleet is fetched and mapped once per `CACHE_TTL.VEHICLES` and every map view, the stats
 * and the raw feed read from it: per-view upstream queries re-parsed the fleet on every pan.
 */
export class VehiclesService {
    constructor(private client: GolemioClient) {}

    private getFleet(env: Env): Promise<Fleet> {
        return CacheManager.getOrFetch<Fleet>(
            'golemio_vehicles',
            CACHE_TTL.VEHICLES * 1000,
            async () => {
                const response = await this.client.fetch("/v2/public/vehiclepositions", env, {
                    cacheTtl: CACHE_TTL.VEHICLES
                }).catch((error: unknown) => {
                    console.error(`Golemio vehicles feed is down`, error);
                    return null;
                });

                if (!response || !response.ok) {
                    if (response) console.error(`Golemio returned ${response.status} for vehicles feed.`);
                    return OFFLINE_FLEET;
                }

                const payload: unknown = await response.json().catch((error: unknown) => {
                    console.error("Golemio vehicles feed returned invalid JSON", error);
                    return null;
                });
                if (payload === null) return OFFLINE_FLEET;

                const parsed = golemioVehiclePayloadSchema.safeParse(payload);
                if (!parsed.success) {
                    console.error("Critical Golemio vehicles structural change:", parsed.error);
                    return OFFLINE_FLEET;
                }

                const data = parsed.data;
                if (data.features) {
                    data.features = data.features.filter((f): f is NonNullable<typeof f> => f !== null);
                }

                return { payload, collection: VehiclesMapper.map(data as GolemioVehiclePayload, getResponseGeneratedAt(response)) };
            },
            (fleet) => fleet.collection.status === 'upstream_offline' || fleet.collection.features.length === 0
        );
    }

    /**
     * Golemio's vehicle positions payload as received, for the debug feed.
     */
    async getRawVehicles(env: Env): Promise<unknown> {
        const { payload } = await this.getFleet(env);
        if (payload === null) throw new ApiError(ERROR_MESSAGES.VEHICLES_DATA_UNAVAILABLE, 503);
        return payload;
    }

    /**
     * Active vehicles within the requested map bounds, route types and lines.
     *
     * @param {Env} env - The environment configuration
     * @param {URLSearchParams} searchParams - The query parameters containing map bounds and filters
     * @returns {Promise<AppVehicleCollection>} Feature collection of active vehicles
     */
    async getVehicles(env: Env, searchParams: URLSearchParams): Promise<AppVehicleCollection> {
        const query = parseSearchParams(searchParams, vehicleQuerySchema);
        return filterVehicles((await this.getFleet(env)).collection, query);
    }

    /**
     * City-wide statistics over the whole fleet.
     */
    async getStats(env: Env): Promise<AppCityStats> {
        const { collection } = await this.getFleet(env);
        if (collection.status === 'upstream_offline') {
            throw new ApiError(ERROR_MESSAGES.VEHICLES_DATA_UNAVAILABLE, 503);
        }
        return aggregateCityStats(collection.features);
    }
}
