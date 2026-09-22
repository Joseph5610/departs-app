import type { AppVehicleCollection } from '../../../_core/types';
import type { CityConfig } from '../../../_core/city-config';
import { FEED_AGE_S } from '../../../_core/feed/freshness';
import { getGtfsRoutes, getGtfsTripRoutes } from '../../../_feeds/gtfs/gtfs-data';
import { getGtfsRtSnapshot } from '../../../_feeds/gtfs/gtfs-rt-feed';
import { VehicleIndex, type VehicleMapping } from '../index/vehicle-index';
import { GtfsVehicleMapping } from '../index/vehicle-mapping';
import { getTripWindows } from '../../../_feeds/gtfs/trip-windows';
import { getLocalClock } from '../../../_core/utils/time';
import type { SingleLiveVehicle, VehicleSource } from './vehicle-source';

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

    async all(): Promise<AppVehicleCollection> {
        const index = await this.index();
        return index ? index.all() : OFFLINE;
    }

    async forTrips(tripIds: Set<string>): Promise<AppVehicleCollection | null> {
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
