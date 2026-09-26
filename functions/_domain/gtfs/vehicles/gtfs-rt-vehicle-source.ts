import type { AppVehicleCollection } from '../../../_core/types';
import type { CityConfig } from '../../../_core/city-config';
import { FEED_AGE_S } from '../../../_core/feed/freshness';
import { getGtfsRoutes, getGtfsTripRoutes } from '../../../_feeds/gtfs/gtfs-data';
import { getGtfsRtSnapshot } from '../../../_feeds/gtfs/gtfs-rt-feed';
import { readCachedFleet, writeCachedFleet, type CachedFleet } from '../../../_feeds/gtfs/fleet-cache';
import { CACHE_CONFIG } from '../../../_core/config';
import { VehicleIndex, type VehicleMapping } from '../index/vehicle-index';
import { GtfsVehicleMapping } from '../index/vehicle-mapping';
import { getTripWindows } from '../../../_feeds/gtfs/trip-windows';
import { getLocalClock } from '../../../_core/utils/time';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import type { SerializedFleet, SingleLiveVehicle, VehicleSource } from './vehicle-source';

const OFFLINE: AppVehicleCollection = { type: 'FeatureCollection', features: [], status: 'upstream_offline' };

/** Old enough that the map has already dropped its positions; nothing else may serve them either. */
const isTooOld = (fetchedAt: number): boolean => (Date.now() - fetchedAt) / 1000 > FEED_AGE_S.OFFLINE;

/**
 * Vehicles read from a GTFS-RT feed. The feed is a source, the reading of it is an index, and what
 * differs between networks lives in their `VehicleMapping`. Boards and details read only the trips
 * or vehicle they name; only `all()`, for the map, resolves the whole network.
 */
export class GtfsRtVehicleSource implements VehicleSource {
    constructor(
        private readonly city: CityConfig,
        private readonly mapping: VehicleMapping = new GtfsVehicleMapping()
    ) {}

    /** Null when the feed or its static data cannot be read; every lookup then answers as offline. */
    private async index(): Promise<VehicleIndex | null> {
        try {
            const [snapshot, routes, tripRoutes, windows] = await Promise.all([
                getGtfsRtSnapshot(this.city),
                getGtfsRoutes(this.city),
                getGtfsTripRoutes(this.city),
                this.mapping.usesTripWindows ? getTripWindows(this.city) : null,
            ]);
            // A failed trip-routes fetch returns empty; mapping against it would blank the map.
            if (Object.keys(tripRoutes.tripRoutes).length === 0) return null;
            return new VehicleIndex(snapshot, routes, tripRoutes, this.mapping, { windows, clock: getLocalClock(this.city.timezone) });
        } catch (e) {
            console.error(`GTFS-RT index unavailable for ${this.city.slug}:`, e instanceof Error ? e.message : e);
            return null;
        }
    }

    /** When this isolate last started a background rebuild, so concurrent stale reads start only one. */
    private refreshStartedAt = 0;

    /**
     * The whole fleet. A fresh isolate reads the last build from the edge cache instead of redecoding
     * the feed and reassigning every vehicle: a killed cold build cannot happen if it never runs. Only
     * a cold cache (no traffic in this colo for `FLEET_CACHE_STALE_MS`) still builds synchronously.
     */
    async all(waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection> {
        return (await this.fleet(waitUntil))?.collection ?? OFFLINE;
    }

    async allSerialized(waitUntil?: (promise: Promise<unknown>) => void): Promise<SerializedFleet | null> {
        const fleet = await this.fleet(waitUntil);
        return fleet ? { json: fleet.json, lastUpdated: fleet.lastUpdated } : null;
    }

    /** The current build, or null when the feed or its static data cannot be read. */
    private async fleet(waitUntil?: (promise: Promise<unknown>) => void): Promise<CachedFleet | null> {
        const cached = await readCachedFleet(this.city.slug);
        if (cached) {
            const age = Date.now() - cached.builtAt;
            if (age < GTFS_CONFIG.FLEET_CACHE_FRESH_MS) return cached;
            if (age < GTFS_CONFIG.FLEET_CACHE_STALE_MS) {
                if (waitUntil && Date.now() - this.refreshStartedAt >= CACHE_CONFIG.REFRESH_WINDOW_MS) {
                    this.refreshStartedAt = Date.now();
                    waitUntil(this.build());
                }
                return cached;
            }
        }
        return this.build();
    }

    /** Builds the fleet and, unless it is offline, caches it for this and the next isolate to read. */
    private async build(): Promise<CachedFleet | null> {
        const index = await this.index();
        const collection = index ? await index.all() : OFFLINE;
        if (collection.status === 'upstream_offline') return null;
        return writeCachedFleet(this.city.slug, collection, GTFS_CONFIG.FLEET_CACHE_STALE_MS / 1000);
    }

    async forTrips(tripIds: Set<string>, waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection | null> {
        if (!this.mapping.resolvesPerEntity) {
            // KORDIS-style networks resolve a trip only network-wide (see VehicleMapping.resolvesPerEntity),
            // so this is exactly as expensive as `all()` either way - share its cached build rather than
            // building a second, uncached copy.
            const all = await this.all(waitUntil);
            if (all.status === 'upstream_offline') return OFFLINE;
            if (isTooOld(Date.parse(all.last_updated ?? '') || 0)) return null;
            return { ...all, features: all.features.filter(f => tripIds.has(f.properties.gtfs_trip_id)) };
        }

        const index = await this.index();
        if (!index) return OFFLINE;
        return isTooOld(index.fetchedAt) ? null : index.forTrips(tripIds);
    }

    async find(vehicleId: string, gtfsTripId?: string): Promise<SingleLiveVehicle> {
        const index = await this.index();
        if (!index) return { liveMatch: undefined };
        // Past this age the map has gone dark, so a detail must not still claim a live position.
        if (isTooOld(index.fetchedAt)) return {};

        const found = await index.find(vehicleId, gtfsTripId);
        return found ? { liveMatch: found.feature, lastStopId: found.lastStopId } : {};
    }
}
