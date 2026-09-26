import type { Env, AppVehicleCollection, CityRequestContext } from "../../../_core/types";
import type { VehiclesUseCase } from "../../use-cases";
import { vehiclesBody, type VehiclesBody } from "../../../_core/feed/vehicles-body";
import { ERROR_MESSAGES } from "../../../_core/config";
import { ApiError } from "../../../_core/errors";
import { derive, type Snapshot } from "../../../_core/feed/source";
import { withFeedAge } from "../../../_core/feed/freshness";
import { getGolemioFleet, type GolemioFleet } from "../../../_feeds/golemio/vehicles";
import { VehiclesMapper } from "./VehiclesMapper";
import { vehicleQuerySchema, parseSearchParams } from "../../../_core/schemas";
import { filterVehicles, isUnfiltered } from "../../../_core/utils/vehicleFilter";

const OFFLINE: AppVehicleCollection = { type: 'FeatureCollection', features: [], status: 'upstream_offline' };

/** The mapped fleet per fleet snapshot, so the map, stats and every pan read one mapping. */
const collections = new WeakMap<object, AppVehicleCollection>();

/** Prague's realtime vehicles, all read from one fleet snapshot per `CACHE_TTL.VEHICLES`. */
export class VehiclesService implements VehiclesUseCase {
    /** The fleet as it should be answered with: positions plus the status their age earns them. */
    private async collection(env: Env): Promise<AppVehicleCollection> {
        const snapshot = await getGolemioFleet(env);
        if (!snapshot) return OFFLINE;
        return withFeedAge(mappedFleet(snapshot), snapshot.fetchedAt);
    }

    /** Golemio's vehicle positions payload as received, for the debug feed. */
    async getRawVehicles(env: Env): Promise<unknown> {
        const payload = (await getGolemioFleet(env))?.data.payload ?? null;
        if (payload === null) throw new ApiError(ERROR_MESSAGES.VEHICLES_DATA_UNAVAILABLE, 503);
        return payload;
    }

    /** The unfiltered map request, answered from the snapshot's collection serialized once. */
    async getVehiclesBody(ctx: CityRequestContext): Promise<VehiclesBody | null> {
        if (!isUnfiltered(parseSearchParams(ctx.url.searchParams, vehicleQuerySchema))) return null;
        const snapshot = await getGolemioFleet(ctx.env);
        return snapshot ? vehiclesBody(mappedFleet(snapshot), snapshot.fetchedAt) : vehiclesBody(OFFLINE);
    }

    /** Active vehicles within the requested map bounds, route types and lines. */
    async getVehicles(ctx: CityRequestContext): Promise<AppVehicleCollection> {
        const query = parseSearchParams(ctx.url.searchParams, vehicleQuerySchema);
        return filterVehicles(await this.collection(ctx.env), query);
    }
}

function mappedFleet(snapshot: Snapshot<GolemioFleet>): AppVehicleCollection {
    return derive(snapshot, collections, () => VehiclesMapper.map(snapshot.data.data, snapshot.data.generatedAt));
}
