import type { CityConfig } from '../../../_core/cityConfig';
import { getGtfsRoutes, getGtfsTripAliases } from '../../../_feeds/gtfs/gtfsData';
import { getGtfsRtSnapshot, getGtfsRtSnapshotIfChanged } from '../../../_feeds/gtfs/gtfsRtFeed';
import type { GtfsRtFeed } from '../../../_core/gtfsRtDecode';
import type { Snapshot } from '../../../_core/feed/source';
import { VehicleIndex, type VehicleMapping } from '../index/VehicleIndex';
import { GtfsVehicleMapping } from '../index/GtfsVehicleMapping';
import { getSchedule } from '../../../_feeds/gtfs/schedule';
import { getLocalClock } from '../../../_core/utils/time';
import type { FleetBuild, NetworkVehicles } from '../../vehicles/vehicleSource';

/**
 * Vehicles read from a GTFS-RT feed. The feed is a source, the reading of it is an index, and what
 * differs between networks lives in their `VehicleMapping`.
 */
export class GtfsRtVehicleSource implements NetworkVehicles {
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
            const clock = getLocalClock(this.city.timezone);
            const [snapshot, routes, schedule, tripAliases] = await Promise.all([
                feed ?? getGtfsRtSnapshot(this.city),
                getGtfsRoutes(this.city),
                getSchedule(this.city, clock),
                getGtfsTripAliases(this.city),
            ]);
            // Mapping against no schedule would blank the map.
            if (!schedule) return null;
            return new VehicleIndex(snapshot, routes, this.mapping, { schedule, tripAliases, clock });
        } catch (e) {
            console.error(`GTFS-RT index unavailable for ${this.city.slug}:`, e instanceof Error ? e.message : e);
            return null;
        }
    }

    /**
     * The whole fleet. When the feed is still the publication `storedEtag` names it is not read or decoded
     * again: upstreams publish less often than the fleet goes stale.
     */
    async buildFleet(storedEtag?: string): Promise<FleetBuild | 'unchanged' | null> {
        let feed: Snapshot<GtfsRtFeed> | undefined;
        if (storedEtag) {
            // An unreadable feed falls through to `index()`, whose source keeps serving the last good read.
            const changed = await getGtfsRtSnapshotIfChanged(this.city, storedEtag).catch(() => undefined);
            if (changed === null) return 'unchanged';
            feed = changed;
        }

        const index = await this.index(feed);
        if (!index) return null;
        const { collection, plates } = await index.allWithPlates();
        return { collection, feedEtag: index.feedEtag, plates };
    }
}
