import type * as GtfsRt from '../../../_core/gtfsRtTypes';
import type { GtfsRtFeed } from '../../../_feeds/gtfs/gtfs-rt-decode';
import type { AppVehicleCollection, AppVehicleFeature } from '../../../_core/types';
import { deriveAsync, type Snapshot } from '../../../_core/feed/source';
import { VehiclesMapper } from '../vehicles/VehiclesMapper';
import type { GtfsRoutesData, GtfsTripRoutesData } from '../../../_feeds/gtfs/gtfs-data';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import type { TripWindows } from '../../../_feeds/gtfs/trip-windows';
import type { LocalClock } from '../../../_core/utils/time';

/** The schedule a mapping reads, loaded once per request so the per-vehicle path stays synchronous. */
export interface MappingSchedule {
    windows: TripWindows | null;
    clock: LocalClock;
}

/**
 * What a network does differently with its realtime feed: which entities count, which trip an entity
 * is serving, what its vehicle is called, and whether it is still waiting to start.
 */
export interface VehicleMapping {
    isRelevant(entity: GtfsRt.IFeedEntity): boolean;
    /** The trips an entity's id may stand for, best first; empty when none is known. */
    tripCandidates(entity: GtfsRt.IFeedEntity, tripRoutes: GtfsTripRoutesData): string[];
    /** The id the network publishes this vehicle under; undefined keeps the feed's own. */
    label(entity: GtfsRt.IFeedEntity): string | undefined;
    /** The entity's last stop in the timetable's id form; undefined keeps the feed's own. */
    stopId?(entity: GtfsRt.IFeedEntity): string | undefined;
    /** Whether an entity refers to the given vehicle; networks differ in which descriptor field carries it. */
    matchesVehicle(entity: GtfsRt.IFeedEntity, vehicleId: string): boolean;
    /** Whether `MappingSchedule.windows` must be loaded for this network. */
    readonly usesTripWindows: boolean;
    isBeforeTrack(tripId: string, schedule: MappingSchedule): boolean;
    /**
     * Whether an entity's own trip id settles which trip it serves.
     *
     * False where vehicles compete for trips (KORDIS repeats them under recycled ids), and then a
     * departure board has to read the same network-wide assignment the map does, or the two disagree.
     */
    resolvesPerEntity: boolean;
    /**
     * One trip per vehicle across the whole feed, for the map. Networks that repeat a vehicle under
     * several trip ids resolve the conflict here; the default takes each entity's first candidate.
     */
    assignAll(entities: GtfsRt.IFeedEntity[], tripRoutes: GtfsTripRoutesData, schedule: MappingSchedule): Array<{ entity: GtfsRt.IFeedEntity; tripId: string }>;
}

const collections = new WeakMap<object, AppVehicleCollection>();

/** Each build's licence plates by `vehicle_id`, where the plate differs from it: shown only on a detail, never in the fleet answer. */
const platesByBuild = new WeakMap<AppVehicleCollection, Record<string, string>>();

/**
 * Reads vehicles out of one feed snapshot.
 *
 * Every lookup maps only the entities it answers with: a detail request maps one vehicle, a
 * departure board maps the trips on it, and only the map itself pays for the whole fleet. The full
 * collection is built at most once per snapshot.
 */
export class VehicleIndex {
    constructor(
        private readonly snapshot: Snapshot<GtfsRtFeed>,
        private readonly routes: GtfsRoutesData,
        private readonly tripRoutes: GtfsTripRoutesData,
        private readonly mapping: VehicleMapping,
        private readonly schedule: MappingSchedule
    ) {}

    /** When the feed behind this index was read. */
    get fetchedAt(): number {
        return this.snapshot.fetchedAt;
    }

    private get entities(): GtfsRt.IFeedEntity[] {
        return this.snapshot.data.entity;
    }

    /** Every vehicle in the network, for the map. Built once per decoded feed and shared. */
    async all(): Promise<AppVehicleCollection> {
        // Keyed by the decoded feed, which is reused while upstream bytes are unchanged: an unchanged feed is not rebuilt.
        const built = await deriveAsync(this.snapshot.data, collections, async () => this.buildAll());
        // Stamped with this read, not the build: a reused fleet would otherwise age past the stale threshold.
        return { ...built, last_updated: new Date(this.snapshot.fetchedAt).toISOString() };
    }

    /** `all()` with its licence plates, for a source that stores the build for details to read. */
    async allWithPlates(): Promise<{ collection: AppVehicleCollection; plates: Record<string, string> }> {
        const built = await deriveAsync(this.snapshot.data, collections, async () => this.buildAll());
        return { collection: { ...built, last_updated: new Date(this.snapshot.fetchedAt).toISOString() }, plates: platesByBuild.get(built) ?? {} };
    }

    private buildAll(): AppVehicleCollection {
        const relevant = this.entities.filter(entity => entity.vehicle && this.mapping.isRelevant(entity));
        const assigned = this.mapping.assignAll(relevant, this.tripRoutes, this.schedule);

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

    /**
     * The vehicles serving the given trips, for departure boards.
     *
     * A board names a handful of trips, so resolving every vehicle in the network to a trip - which
     * only the map needs - is skipped.
     */
    async forTrips(tripIds: Set<string>): Promise<AppVehicleCollection> {
        if (!this.mapping.resolvesPerEntity) {
            const all = await this.all();
            return { ...all, features: all.features.filter(f => tripIds.has(f.properties.gtfs_trip_id)) };
        }

        const features: AppVehicleFeature[] = [];
        const coveredTrips = new Set<string>();
        const coveredVehicles = new Set<string>();

        if (tripIds.size > 0) {
            for (const entity of this.entities) {
                if (!entity.vehicle || !this.mapping.isRelevant(entity)) continue;
                // One vehicle serves one trip, as on the map: a feed that repeats a vehicle under a
                // recycled id must not attach it to a second departure.
                const label = this.mapping.label(entity) ?? entity.id ?? '';
                if (coveredVehicles.has(label)) continue;

                const tripId = this.mapping.tripCandidates(entity, this.tripRoutes).find(id => tripIds.has(id) && !coveredTrips.has(id));
                if (!tripId) continue;
                const mapped = this.map(entity, tripId);
                if (!mapped) continue;
                coveredTrips.add(tripId);
                if (label) coveredVehicles.add(label);
                features.push(mapped);
            }
        }

        return { type: 'FeatureCollection', features, last_updated: new Date(this.snapshot.fetchedAt).toISOString() };
    }

    /**
     * One vehicle, for a detail request that already names its trip.
     *
     * The requested vehicle wins over its trip: a trip lookup can land on a different vehicle, which
     * would move the selection. A trip-only match still serves a stale or unknown vehicle id.
     */
    async find(vehicleId: string, gtfsTripId?: string): Promise<{ feature: AppVehicleFeature; lastStopId?: string; registrationNumber?: string } | null> {
        let vehicleOnly: GtfsRt.IFeedEntity | undefined;
        let tripOnly: GtfsRt.IFeedEntity | undefined;

        for (const entity of this.entities) {
            if (!entity.vehicle || !this.mapping.isRelevant(entity)) continue;
            const onTrip = !!gtfsTripId && this.mapping.tripCandidates(entity, this.tripRoutes).includes(gtfsTripId);
            const isVehicle = !vehicleId || this.mapping.matchesVehicle(entity, vehicleId);
            if (isVehicle) {
                if (onTrip) { vehicleOnly = entity; break; }
                if (vehicleId && !vehicleOnly) vehicleOnly = entity;
            } else if (onTrip && !tripOnly) {
                tripOnly = entity;
            }
        }

        const entity = vehicleOnly ?? tripOnly;
        if (!entity?.vehicle) return null;

        const candidates = this.mapping.tripCandidates(entity, this.tripRoutes);
        // The client named the trip it opened, so an id recycled across exports resolves to that one.
        const tripId = gtfsTripId && candidates.includes(gtfsTripId) ? gtfsTripId : candidates[0];
        if (!tripId) return null;

        const feature = this.map(entity, tripId);
        return feature ? { feature, lastStopId: this.stopIdOf(entity), registrationNumber: entity.vehicle.vehicle?.licensePlate || undefined } : null;
    }

    /** One entity as a vehicle feature; null when it is stale or its route is unknown. */
    private map(entity: GtfsRt.IFeedEntity, tripId: string): AppVehicleFeature | null {
        const vp = entity.vehicle;
        if (!vp) return null;

        const nowMs = Date.now();
        const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
        if (nowMs - lastUpdate > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) return null;

        const route = this.routes.routes[this.tripRoutes.tripRoutes[tripId]];
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
