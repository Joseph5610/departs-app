import type { AppVehicleCollection, Env } from '../../../_core/types';
import { ERROR_MESSAGES } from '../../../_core/config';
import { ApiError } from '../../../_core/errors';
import { derive, type Snapshot } from '../../../_core/feed/source';
import { getGolemioVehiclePositions, type GolemioVehiclePositions } from '../../../_feeds/golemio/vehicles';
import type { FleetBuild, NetworkVehicles } from '../../vehicles/vehicleSource';
import { mapGolemioVehicles } from './golemioVehiclesMapper';

/** The mapped fleet per vehicle positions snapshot, so the map, stats and every pan read one mapping. */
const collections = new WeakMap<object, AppVehicleCollection>();

/**
 * Prague's vehicles: Golemio's positions already carry each vehicle's trip, so the fleet is only reshaped.
 * `EdgeFleetSource` caches it like every other city's.
 */
export class GolemioVehicles implements NetworkVehicles {
    readonly agedFromBuild = true;

    constructor(private readonly env: Env) {}

    async buildFleet(): Promise<FleetBuild | null> {
        const snapshot = await getGolemioVehiclePositions(this.env);
        return snapshot ? { collection: mappedFleet(snapshot) } : null;
    }

    /** Golemio's vehicle positions payload as received, for the debug feed. */
    async rawPayload(): Promise<unknown> {
        const payload = (await getGolemioVehiclePositions(this.env))?.data.payload ?? null;
        if (payload === null) throw new ApiError(ERROR_MESSAGES.VEHICLES_DATA_UNAVAILABLE, 503);
        return payload;
    }
}

function mappedFleet(snapshot: Snapshot<GolemioVehiclePositions>): AppVehicleCollection {
    return derive(snapshot, collections, () => mapGolemioVehicles(snapshot.data.data, snapshot.data.generatedAt));
}
