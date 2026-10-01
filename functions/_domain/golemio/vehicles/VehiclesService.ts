import type { Env, AppVehicleCollection, CityRequestContext } from "../../../_core/types";
import type { VehiclesUseCase } from "../../use-cases";
import { vehiclesBody, vehiclesBodyFromJson, type VehiclesBody } from "../../../_core/feed/vehicles-body";
import { ERROR_MESSAGES } from "../../../_core/config";
import { ApiError } from "../../../_core/errors";
import { derive, type Snapshot } from "../../../_core/feed/source";
import { withFeedAge } from "../../../_core/feed/freshness";
import { getGolemioVehiclePositions, type GolemioVehiclePositions } from "../../../_feeds/golemio/vehicles";
import { readCachedFleet, writeCachedFleet, type CachedFleet } from "../../../_core/feed/vehicle-cache";
import { GOLEMIO_CONFIG } from "../../../_feeds/golemio/config";
import { VehiclesMapper } from "./VehiclesMapper";
import { vehicleQuerySchema, parseSearchParams } from "../../../_core/schemas";
import { filterVehicles, isUnfiltered } from "../../../_core/utils/vehicleFilter";

const OFFLINE: AppVehicleCollection = { type: 'FeatureCollection', features: [], status: 'upstream_offline' };

/** The mapped fleet per vehicle positions snapshot, so the map, stats and every pan read one mapping. */
const collections = new WeakMap<object, AppVehicleCollection>();

const FLEET_KEY = 'golemio_prague';

/**
 * Prague's realtime vehicles. The fleet is built at most once per `VEHICLES_CACHE_FRESH_MS` - cached at
 * the edge (see `_core/feed/vehicle-cache.ts`, shared with the GTFS cities' own fleet source) so a
 * freshly spawned isolate reads another isolate's recent build instead of re-fetching, re-shape-checking
 * and re-mapping the whole ~2,200-vehicle feed itself.
 */
export class VehiclesService implements VehiclesUseCase {
    /** The current build, refreshed in this request when stale - served first, the refresh reaches only the next request. */
    private async fleet(env: Env, waitUntil?: (promise: Promise<unknown>) => void): Promise<CachedFleet | null> {
        const cached = await readCachedFleet(FLEET_KEY);
        if (cached && Date.now() - cached.builtAt < GOLEMIO_CONFIG.VEHICLES_CACHE_FRESH_MS) return cached;

        const built = await this.build(env, waitUntil);
        if (built) return built;
        return cached && Date.now() - cached.builtAt < GOLEMIO_CONFIG.VEHICLES_CACHE_STALE_MS ? cached : null;
    }

    /** Builds the fleet and caches it for this and the next isolate to read; `waitUntil`, when given, lets the edge write outlive this request. */
    private async build(env: Env, waitUntil?: (promise: Promise<unknown>) => void): Promise<CachedFleet | null> {
        const snapshot = await getGolemioVehiclePositions(env);
        if (!snapshot) return null;

        return writeCachedFleet(FLEET_KEY, mappedFleet(snapshot), GOLEMIO_CONFIG.VEHICLES_CACHE_STALE_MS / 1000, undefined, undefined, waitUntil);
    }

    /** Golemio's vehicle positions payload as received, for the debug feed. */
    async getRawVehicles(env: Env): Promise<unknown> {
        const payload = (await getGolemioVehiclePositions(env))?.data.payload ?? null;
        if (payload === null) throw new ApiError(ERROR_MESSAGES.VEHICLES_DATA_UNAVAILABLE, 503);
        return payload;
    }

    /** The unfiltered map request, answered from the cached build's JSON serialized once. */
    async getVehiclesBody(ctx: CityRequestContext): Promise<VehiclesBody | null> {
        if (!isUnfiltered(parseSearchParams(ctx.url.searchParams, vehicleQuerySchema))) return null;
        const fleet = await this.fleet(ctx.env, ctx.waitUntil);
        return fleet
            ? vehiclesBodyFromJson(fleet.body, fleet.lastUpdated ? Date.parse(fleet.lastUpdated) : NaN, fleet.lastUpdated)
            : vehiclesBody(OFFLINE);
    }

    /** Active vehicles within the requested map bounds, route types and lines. */
    async getVehicles(ctx: CityRequestContext): Promise<AppVehicleCollection> {
        const query = parseSearchParams(ctx.url.searchParams, vehicleQuerySchema);
        const fleet = await this.fleet(ctx.env, ctx.waitUntil);
        return filterVehicles(withFeedAge(fleet?.collection ?? OFFLINE, fleet?.builtAt), query);
    }
}

function mappedFleet(snapshot: Snapshot<GolemioVehiclePositions>): AppVehicleCollection {
    return derive(snapshot, collections, () => VehiclesMapper.map(snapshot.data.data, snapshot.data.generatedAt));
}
