import type { Env, AppVehicleCollection, CityRequestContext } from "../../../_core/types";
import type { VehiclesUseCase } from "../../use-cases";
import { ERROR_MESSAGES } from "../../../_core/config";
import { ApiError } from "../../../_core/errors";
import { derive } from "../../../_core/feed/source";
import { withFeedAge } from "../../../_core/feed/freshness";
import { getGolemioFleet } from "../../../_feeds/golemio/vehicles";
import { VehiclesMapper } from "./VehiclesMapper";
import { vehicleQuerySchema, parseSearchParams } from "../../../_core/schemas";
import { filterVehicles } from "../../../_core/utils/vehicleFilter";

const OFFLINE: AppVehicleCollection = { type: 'FeatureCollection', features: [], status: 'upstream_offline' };

/** The mapped fleet per fleet snapshot, so the map, stats and every pan read one mapping. */
const collections = new WeakMap<object, AppVehicleCollection>();

/** Prague's realtime vehicles, all read from one fleet snapshot per `CACHE_TTL.VEHICLES`. */
export class VehiclesService implements VehiclesUseCase {
    /** The fleet as it should be answered with: positions plus the status their age earns them. */
    private async collection(env: Env): Promise<AppVehicleCollection> {
        const snapshot = await getGolemioFleet(env);
        if (!snapshot) return OFFLINE;
        const collection = derive(snapshot, collections, () => VehiclesMapper.map(snapshot.data.data, snapshot.data.generatedAt));
        return withFeedAge(collection, snapshot.fetchedAt);
    }

    /** Golemio's vehicle positions payload as received, for the debug feed. */
    async getRawVehicles(env: Env): Promise<unknown> {
        const payload = (await getGolemioFleet(env))?.data.payload ?? null;
        if (payload === null) throw new ApiError(ERROR_MESSAGES.VEHICLES_DATA_UNAVAILABLE, 503);
        return payload;
    }

    /** Active vehicles within the requested map bounds, route types and lines. */
    async getVehicles(ctx: CityRequestContext): Promise<AppVehicleCollection> {
        const query = parseSearchParams(ctx.url.searchParams, vehicleQuerySchema);
        return filterVehicles(await this.collection(ctx.env), query);
    }
}
