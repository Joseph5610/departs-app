import type * as GtfsRt from '../../../_core/gtfsRtTypes';
import type { GtfsRtFeed } from '../../../_core/gtfsRtDecode';
import type { AppVehicleCollection, AppVehicleFeature } from '../../../_core/types';
import { deriveAsync, type Snapshot } from '../../../_core/feed/source';
import { VehiclesMapper } from '../vehicles/VehiclesMapper';
import type { GtfsRoutesData } from '../../../_feeds/gtfs/gtfs-data';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import { routeIdOf, type Schedule } from '../../../_feeds/gtfs/schedule';
import type { TripRuns } from '../../../_feeds/gtfs/trip-runs';
import type { LocalClock } from '../../../_core/utils/time';

/** The schedule a mapping reads, loaded once per request so the per-vehicle path stays synchronous. */
export interface MappingSchedule {
    /** The trips a vehicle may be matched to now. */
    schedule: Schedule;
    /** Trip ids of older timetable exports -> the current trip, for feeds that still use them. */
    tripAliases: TripRuns;
    clock: LocalClock;
}

/**
 * What a network does differently with its realtime feed: which entities count, which trip an entity
 * is serving, what its vehicle is called, and whether it is still waiting to start.
 */
export interface VehicleMapping {
    isRelevant(entity: GtfsRt.IFeedEntity): boolean;
    /** The trips an entity's id may stand for, best first; empty when none is known. */
    tripCandidates(entity: GtfsRt.IFeedEntity, schedule: MappingSchedule): string[];
    /** The id the network publishes this vehicle under; undefined keeps the feed's own. */
    label(entity: GtfsRt.IFeedEntity): string | undefined;
    /** The entity's last stop in the timetable's id form; undefined keeps the feed's own. */
    stopId?(entity: GtfsRt.IFeedEntity): string | undefined;
    isBeforeTrack(tripId: string, schedule: MappingSchedule): boolean;
    /**
     * One trip per vehicle across the whole feed, for the map. Networks that repeat a vehicle under
     * several trip ids resolve the conflict here; the default takes each entity's first candidate.
     */
    assignAll(entities: GtfsRt.IFeedEntity[], schedule: MappingSchedule): Array<{ entity: GtfsRt.IFeedEntity; tripId: string }>;
}

const collections = new WeakMap<object, AppVehicleCollection>();

/** Each build's licence plates by `vehicle_id`, where the plate differs from it: shown only on a detail, never in the fleet answer. */
const platesByBuild = new WeakMap<AppVehicleCollection, Record<string, string>>();

/** Reads the whole fleet out of one feed snapshot, built at most once per snapshot. */
export class VehicleIndex {
    constructor(
        private readonly snapshot: Snapshot<GtfsRtFeed>,
        private readonly routes: GtfsRoutesData,
        private readonly mapping: VehicleMapping,
        private readonly schedule: MappingSchedule
    ) {}

    /** When the feed behind this index was read. */
    get fetchedAt(): number {
        return this.snapshot.fetchedAt;
    }

    /** The ETag of the feed publication this index reads, when the upstream sends one. */
    get feedEtag(): string | undefined {
        return this.snapshot.data.etag;
    }

    private get entities(): GtfsRt.IFeedEntity[] {
        return this.snapshot.data.entity;
    }

    /** Every vehicle in the network with its licence plates, built once per decoded feed and shared. */
    async allWithPlates(): Promise<{ collection: AppVehicleCollection; plates: Record<string, string> }> {
        // Keyed by the decoded feed, which is reused while upstream bytes are unchanged: an unchanged feed is not rebuilt.
        const built = await deriveAsync(this.snapshot.data, collections, async () => this.buildAll());
        // Stamped with this read, not the build: a reused fleet would otherwise age past the stale threshold.
        return { collection: { ...built, last_updated: new Date(this.snapshot.fetchedAt).toISOString() }, plates: platesByBuild.get(built) ?? {} };
    }

    private buildAll(): AppVehicleCollection {
        const relevant = this.entities.filter(entity => entity.vehicle && this.mapping.isRelevant(entity));
        const assigned = this.mapping.assignAll(relevant, this.schedule);

        const features: AppVehicleFeature[] = [];
        const plates: Record<string, string> = {};
        for (const { entity, tripId } of assigned) {
            const mapped = this.map(entity, tripId);
            if (!mapped) continue;
            features.push(mapped);
            const plate = entity.vehicle?.vehicle?.licensePlate;
            if (plate && mapped.properties.vehicle_id && plate !== mapped.properties.vehicle_id) plates[mapped.properties.vehicle_id] = plate;
        }
        const collection: AppVehicleCollection = { type: 'FeatureCollection', features, last_updated: new Date(this.snapshot.fetchedAt).toISOString() };
        platesByBuild.set(collection, plates);
        return collection;
    }

    /** One entity as a vehicle feature; null when it is stale or its route is unknown. */
    private map(entity: GtfsRt.IFeedEntity, tripId: string): AppVehicleFeature | null {
        const vp = entity.vehicle;
        if (!vp) return null;

        const nowMs = Date.now();
        const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
        if (nowMs - lastUpdate > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) return null;

        const routeId = routeIdOf(this.schedule.schedule, tripId);
        const route = routeId ? this.routes.routes[routeId] : undefined;
        if (!route) return null;

        const label = vp.vehicle ? this.mapping.label(entity) : undefined;
        const feature = VehiclesMapper.mapVehicle(vp, tripId, route, new Date(lastUpdate).toISOString(), null, this.mapping.isBeforeTrack(tripId, this.schedule), label);
        // The feed's only progress signal (no stop sequence, no delay): a detail places the vehicle on its trip from it.
        const stopId = this.stopIdOf(entity);
        if (stopId) feature.properties.last_stop_id = stopId;
        return feature;
    }

    private stopIdOf(entity: GtfsRt.IFeedEntity): string | undefined {
        return this.mapping.stopId ? this.mapping.stopId(entity) : entity.vehicle?.stopId ?? undefined;
    }
}
