import type { AppVehicleCollection } from '../../../_core/types';
import { currentFleet, writeCachedFleet, type CachedFleet } from '../../../_core/feed/vehicle-cache';
import { OFFLINE_VEHICLES } from '../../../_core/feed/freshness';
import type { SingleLiveVehicle, VehicleSource } from './vehicle-source';


/**
 * A source whose `all()` builds the whole fleet, given the edge fleet cache the GTFS-RT and Golemio
 * sources keep themselves: a fresh isolate reads another isolate's recent build instead of building its own.
 */
export class EdgeFleetSource implements VehicleSource {
    readonly sharesFleet = true;
    readonly find?: (vehicleId: string, gtfsTripId?: string) => Promise<SingleLiveVehicle>;
    readonly forTrips?: (tripIds: Set<string>, waitUntil?: (promise: Promise<unknown>) => void) => Promise<AppVehicleCollection | null>;
    readonly augmentSingleLiveVehicle?: (result: SingleLiveVehicle) => Promise<SingleLiveVehicle>;

    constructor(
        private readonly key: string,
        private readonly inner: VehicleSource
    ) {
        this.find = inner.find?.bind(inner);
        this.forTrips = inner.forTrips?.bind(inner);
        this.augmentSingleLiveVehicle = inner.augmentSingleLiveVehicle?.bind(inner);
    }

    private fleet(waitUntil?: (promise: Promise<unknown>) => void): Promise<CachedFleet | null> {
        return currentFleet(this.key, async () => {
            const collection = await this.inner.all();
            if (collection.status === 'upstream_offline') return null;
            return writeCachedFleet(this.key, collection, undefined, undefined, waitUntil);
        });
    }

    async all(waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection> {
        return (await this.fleet(waitUntil))?.collection ?? OFFLINE_VEHICLES;
    }

    async allJson(waitUntil?: (promise: Promise<unknown>) => void): Promise<{ json: string; lastUpdated?: string } | null> {
        const fleet = await this.fleet(waitUntil);
        return fleet ? { json: fleet.body, lastUpdated: fleet.lastUpdated } : null;
    }
}
