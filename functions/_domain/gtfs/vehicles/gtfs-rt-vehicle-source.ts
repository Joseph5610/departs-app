import type { AppVehicleCollection } from '../../../_core/types';
import type { CityConfig } from '../../../_core/city-config';
import { FEED_AGE_S, OFFLINE_VEHICLES } from '../../../_core/feed/freshness';
import { getGtfsRoutes, getGtfsTripAliases, getGtfsTripRoutes } from '../../../_feeds/gtfs/gtfs-data';
import { getGtfsRtSnapshot, getGtfsRtSnapshotIfChanged } from '../../../_feeds/gtfs/gtfs-rt-feed';
import type { GtfsRtFeed } from '../../../_feeds/gtfs/gtfs-rt-decode';
import type { Snapshot } from '../../../_core/feed/source';
import { currentFleet, readFleetPlates, restampCachedFleet, writeCachedFleet, type CachedFleet } from '../../../_core/feed/vehicle-cache';
import { VehicleIndex, type VehicleMapping } from '../index/vehicle-index';
import { GtfsVehicleMapping } from '../index/vehicle-mapping';
import { getTripWindows } from '../../../_feeds/gtfs/trip-windows';
import { getLocalClock } from '../../../_core/utils/time';
import type { SingleLiveVehicle, VehicleSource } from './vehicle-source';


/** Old enough that the map has already dropped its positions; nothing else may serve them either. */
const isTooOld = (fetchedAt: number): boolean => (Date.now() - fetchedAt) / 1000 > FEED_AGE_S.OFFLINE;

/**
 * Vehicles read from a GTFS-RT feed. The feed is a source, the reading of it is an index, and what
 * differs between networks lives in their `VehicleMapping`. Boards and details read only the trips
 * or vehicle they name; only `all()`, for the map, resolves the whole network.
 */
export class GtfsRtVehicleSource implements VehicleSource {
    readonly sharesFleet = true;

    constructor(
        private readonly city: CityConfig,
        private readonly mapping: VehicleMapping = new GtfsVehicleMapping()
    ) {}

    /**
     * Null when the feed or its static data cannot be read; every lookup then answers as offline. `feed`
     * is a snapshot the caller already read, so the feed is not downloaded twice.
     */
    private async index(feed?: Snapshot<GtfsRtFeed>): Promise<VehicleIndex | null> {
        try {
            const [snapshot, routes, tripRoutes, tripAliases, windows] = await Promise.all([
                feed ?? getGtfsRtSnapshot(this.city),
                getGtfsRoutes(this.city),
                getGtfsTripRoutes(this.city),
                getGtfsTripAliases(this.city),
                this.mapping.usesTripWindows ? getTripWindows(this.city) : null,
            ]);
            // A failed trip-routes fetch returns empty; mapping against it would blank the map.
            if (!tripRoutes) return null;
            return new VehicleIndex(snapshot, routes, { tripRoutes, tripAliases }, this.mapping, { windows, clock: getLocalClock(this.city.timezone) });
        } catch (e) {
            console.error(`GTFS-RT index unavailable for ${this.city.slug}:`, e instanceof Error ? e.message : e);
            return null;
        }
    }

    /**
     * The whole fleet. A fresh isolate reads the last build from the edge cache instead of redecoding
     * the feed and reassigning every vehicle.
     */
    async all(): Promise<AppVehicleCollection> {
        return (await this.fleet())?.collection ?? OFFLINE_VEHICLES;
    }

    async allJson(): Promise<{ json: string; lastUpdated?: string } | null> {
        const fleet = await this.fleet();
        return fleet ? { json: fleet.body, lastUpdated: fleet.lastUpdated } : null;
    }

    /**
     * The current build, or null when the feed or its static data cannot be read. A stale build is
     * refreshed in this request, not after it: served first, the refresh reached only the next request.
     */
    private fleet(): Promise<CachedFleet | null> {
        return currentFleet(this.city.slug, (stored) => this.build(stored));
    }

    /**
     * Builds the fleet and, unless it is offline, caches it for this and the next isolate to read. When
     * the feed is still the publication `stored` was built from, `stored` is only re-stamped as read now:
     * upstreams publish less often than the fleet goes stale, and a fresh isolate has no build of its own to reuse.
     */
    private async build(stored: CachedFleet | null): Promise<CachedFleet | null> {
        let feed: Snapshot<GtfsRtFeed> | undefined;
        if (stored?.feedEtag) {
            // An unreadable feed falls through to `index()`, whose source keeps serving the last good read.
            const changed = await getGtfsRtSnapshotIfChanged(this.city, stored.feedEtag).catch(() => undefined);
            if (changed === null) return restampCachedFleet(this.city.slug, stored, new Date().toISOString());
            feed = changed;
        }

        const index = await this.index(feed);
        if (!index) return null;
        const { collection, plates } = await index.allWithPlates();
        return writeCachedFleet(this.city.slug, collection, index.feedEtag, plates);
    }

    async forTrips(tripIds: Set<string>): Promise<AppVehicleCollection | null> {
        if (!this.mapping.resolvesPerEntity) {
            // KORDIS-style networks resolve a trip only network-wide (see VehicleMapping.resolvesPerEntity),
            // so this is exactly as expensive as `all()` either way - share its cached build rather than
            // building a second, uncached copy.
            const all = await this.all();
            if (all.status === 'upstream_offline') return OFFLINE_VEHICLES;
            if (isTooOld(Date.parse(all.last_updated ?? '') || 0)) return null;
            return { ...all, features: all.features.filter(f => tripIds.has(f.properties.gtfs_trip_id)) };
        }

        const index = await this.index();
        if (!index) return OFFLINE_VEHICLES;
        return isTooOld(index.fetchedAt) ? null : index.forTrips(tripIds);
    }

    async find(vehicleId: string, gtfsTripId?: string): Promise<SingleLiveVehicle> {
        if (!this.mapping.resolvesPerEntity && vehicleId) {
            // The stored build already resolved every vehicle to its trip, the map's answer: a vehicle on another trip there has moved on.
            const fleet = await this.fleet();
            if (fleet && isTooOld(Date.parse(fleet.lastUpdated ?? '') || 0)) return {};
            const feature = fleet?.collection.features.find(f => f.properties.vehicle_id === vehicleId);
            if (fleet && feature) {
                const plates = await readFleetPlates(this.city.slug, fleet);
                return { liveMatch: feature, lastStopId: feature.properties.last_stop_id, registrationNumber: plates[vehicleId] };
            }
        }

        const index = await this.index();
        if (!index) return { liveMatch: undefined };
        // Past this age the map has gone dark, so a detail must not still claim a live position.
        if (isTooOld(index.fetchedAt)) return {};

        const found = await index.find(vehicleId, gtfsTripId);
        return found ? { liveMatch: found.feature, lastStopId: found.lastStopId, registrationNumber: found.registrationNumber } : {};
    }
}
