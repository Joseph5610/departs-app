import type { AppVehicleCollection, AppVehicleFeature } from '../../_core/types';
import { currentFleet, readFleetPlates, restampCachedFleet, writeCachedFleet, type CachedFleet } from '../../_core/feed/vehicle-cache';
import { feedStatusAt, OFFLINE_VEHICLES, withFeedAge } from '../../_core/feed/freshness';
import type { NetworkVehicles, SingleLiveVehicle } from './vehicle-source';

/** Past `FEED_AGE_S.OFFLINE` the map has dropped the fleet, so no detail or board may still show its vehicles. */
const isOffline = (fleet: CachedFleet): boolean => feedStatusAt(fleet.lastUpdated ? Date.parse(fleet.lastUpdated) : NaN) === 'upstream_offline';

/** The feature of `vehicleId`, else the first serving `tripId`. */
function vehicleIn(collection: AppVehicleCollection, vehicleId: string, tripId?: string): AppVehicleFeature | undefined {
    let byTrip: AppVehicleFeature | undefined;
    for (const feature of collection.features) {
        const props = feature.properties;
        if (vehicleId && props.vehicle_id === vehicleId) return feature;
        if (tripId && !byTrip && props.gtfs_trip_id === tripId) byTrip = feature;
    }
    return byTrip;
}

/**
 * Every GTFS-stack city's vehicles: the network builds its fleet, this keeps the build in the shared fleet
 * cache so a fresh isolate reads another isolate's recent one, and answers details and boards from it.
 */
export class EdgeFleetSource {
    constructor(
        private readonly key: string,
        private readonly network: NetworkVehicles
    ) {}

    /**
     * The current build, refreshed in this request when stale; an unchanged feed only re-stamps the stored
     * one. `waitUntil`, when given, lets the edge write outlive the response.
     */
    private fleet(waitUntil?: (promise: Promise<unknown>) => void): Promise<CachedFleet | null> {
        return currentFleet(this.key, async (stored) => {
            const build = await this.network.buildFleet(stored?.feedEtag);
            if (build === 'unchanged') return stored ? restampCachedFleet(this.key, stored, new Date().toISOString(), waitUntil) : null;
            if (!build || build.collection.status === 'upstream_offline') return null;
            return writeCachedFleet(this.key, build.collection, build.feedEtag, build.plates, waitUntil);
        });
    }

    /** Every vehicle with the status its age earns it (`withFeedAge`). */
    async aged(waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection> {
        const fleet = await this.fleet(waitUntil);
        return withFeedAge(fleet?.collection ?? OFFLINE_VEHICLES, this.network.agedFromBuild ? fleet?.builtAt : undefined);
    }

    /** The stored fleet JSON (without `status`), sparing a parse and re-serialize; null when offline. */
    async allJson(waitUntil?: (promise: Promise<unknown>) => void): Promise<{ json: string; lastUpdated?: string } | null> {
        const fleet = await this.fleet(waitUntil);
        return fleet ? { json: fleet.body, lastUpdated: fleet.lastUpdated } : null;
    }

    /** One vehicle for a detail, with whatever extra the network's own feed adds to it. */
    async find(vehicleId: string, gtfsTripId?: string): Promise<SingleLiveVehicle> {
        const result = await this.lookup(vehicleId, gtfsTripId);
        return this.network.augmentSingleLiveVehicle ? this.network.augmentSingleLiveVehicle(result) : result;
    }

    /** By vehicle in the cached fleet, else by trip: a detail shows only what the map shows. */
    private async lookup(vehicleId: string, gtfsTripId?: string): Promise<SingleLiveVehicle> {
        const fleet = await this.fleet();
        if (!fleet) return { liveMatch: undefined };
        if (isOffline(fleet)) return {};
        const feature = vehicleIn(fleet.collection, vehicleId, gtfsTripId);
        if (!feature) return { liveMatch: undefined };
        const plates = await readFleetPlates(this.key, fleet);
        const id = feature.properties.vehicle_id;
        return { liveMatch: feature, lastStopId: feature.properties.last_stop_id, registrationNumber: id ? plates[id] : undefined };
    }

    /** The vehicles serving the given trips, for departure boards; null once the fleet is too old to show positions. */
    async forTrips(tripIds: Set<string>, waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection | null> {
        const fleet = await this.fleet(waitUntil);
        if (!fleet) return OFFLINE_VEHICLES;
        if (isOffline(fleet)) return null;
        return { ...fleet.collection, features: fleet.collection.features.filter(f => tripIds.has(f.properties.gtfs_trip_id)) };
    }
}
