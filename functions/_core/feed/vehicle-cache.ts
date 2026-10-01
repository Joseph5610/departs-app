import { readEdgeCache, writeEdgeCache } from '../ApiClient';
import type { AppVehicleCollection } from '../types';

/**
 * A network's built fleet (every vehicle mapped and, for GTFS-RT networks, assigned to a trip), kept
 * serialized so the map's unfiltered request is answered without parsing it. `_domain` builds it; this
 * is the one place - in `_core/feed`, per the layering rule `_domain` never touches `ApiClient` directly
 * - that reads or writes it. Shared by every network that caches its whole mapped collection at the
 * edge: GTFS-RT cities key it by `citySlug`, Golemio's single Prague feed by its own fixed key.
 */
export class CachedFleet {
    private parsed: AppVehicleCollection | undefined;
    private withLastUpdated: string | undefined;
    /** Licence plates by `vehicle_id`, once read; see `readFleetPlates`. Unset for networks with none. */
    plates: Record<string, string> | undefined;

    /**
     * `json` is the collection without `last_updated` and `status`: both change without the vehicles
     * changing, so a re-stamp reuses `json` as it is.
     */
    constructor(
        readonly builtAt: number,
        readonly json: string,
        readonly lastUpdated: string | undefined,
        /** The ETag of the feed publication this was built from, for a conditional re-read. */
        readonly feedEtag: string | undefined,
        private readonly base?: AppVehicleCollection
    ) {}

    /** The collection, parsed on first use. Shared by every request in the isolate: never mutate it. */
    get collection(): AppVehicleCollection {
        this.parsed ??= { ...(this.base ?? JSON.parse(this.json) as AppVehicleCollection), last_updated: this.lastUpdated };
        return this.parsed;
    }

    /** `json` with `last_updated`, as the collection serializes: what the map is answered with. */
    get body(): string {
        this.withLastUpdated ??= this.lastUpdated === undefined ? this.json : `${this.json.slice(0, -1)},"last_updated":${JSON.stringify(this.lastUpdated)}}`;
        return this.withLastUpdated;
    }

    /** This build as read now from an unchanged feed: same vehicles, new read time. */
    restamped(lastUpdated: string): CachedFleet {
        const entry = new CachedFleet(Date.now(), this.json, lastUpdated, this.feedEtag, this.base ?? this.parsed);
        entry.plates = this.plates;
        return entry;
    }
}

const BUILT_AT_HEADER = 'X-Fleet-Built-At';
const LAST_UPDATED_HEADER = 'X-Fleet-Last-Updated';
const FEED_ETAG_HEADER = 'X-Fleet-Feed-Etag';

/** This isolate's newest build per key, so a warm isolate skips both the Cache API and the parse. */
const inMemory = new Map<string, CachedFleet>();

/** Versioned with the stored JSON's shape, so a build stored in an older shape is never read as this one. */
function cacheKey(key: string): string {
    return `vehicles_fleet_v2_${key}`;
}

/** Plates are a separate entry, so the fleet answer never carries them and only a detail reads them. */
function platesKey(key: string): string {
    return `vehicles_fleet_plates_${key}`;
}

/** The licence plates stored with `fleet`'s key, by `vehicle_id`; empty when none were stored. */
export async function readFleetPlates(key: string, fleet: CachedFleet): Promise<Record<string, string>> {
    if (fleet.plates) return fleet.plates;
    const res = await readEdgeCache(platesKey(key));
    fleet.plates = res ? await res.json() as Record<string, string> : {};
    return fleet.plates;
}

async function readEdgeFleet(key: string): Promise<CachedFleet | null> {
    const res = await readEdgeCache(cacheKey(key));
    if (!res) return null;
    const builtAt = Number(res.headers.get(BUILT_AT_HEADER));
    if (!Number.isFinite(builtAt) || builtAt <= 0) return null;
    return new CachedFleet(builtAt, await res.text(), res.headers.get(LAST_UPDATED_HEADER) ?? undefined, res.headers.get(FEED_ETAG_HEADER) ?? undefined);
}

/**
 * The newest build cached for `key`: this isolate's own while younger than `freshMs`, else whichever of
 * it and the edge copy (possibly rebuilt by another isolate) is newer. Null on a miss or with no Cache API.
 */
export async function readCachedFleet(key: string, freshMs: number): Promise<CachedFleet | null> {
    const local = inMemory.get(key);
    if (local && Date.now() - local.builtAt < freshMs) return local;

    const edge = await readEdgeFleet(key);
    const newest = edge && (!local || edge.builtAt > local.builtAt) ? edge : local ?? null;
    if (newest) inMemory.set(key, newest);
    return newest;
}

/**
 * Stores a freshly built fleet, and its licence plates when given, in this isolate and at the edge for
 * `ttlS` seconds. Awaited by default; a caller with a `waitUntil` can instead let the edge write run
 * past its response, so the build's own cost is the only one charged to this request.
 */
export async function writeCachedFleet(
    key: string,
    collection: AppVehicleCollection,
    ttlS: number,
    feedEtag?: string,
    plates?: Record<string, string>,
    waitUntil?: (promise: Promise<unknown>) => void
): Promise<CachedFleet> {
    const base = { ...collection, last_updated: undefined, status: undefined };
    const entry = new CachedFleet(Date.now(), JSON.stringify(base), collection.last_updated, feedEtag, base);
    if (plates) entry.plates = plates;
    const write = storeFleet(key, entry, ttlS, plates);
    if (waitUntil) waitUntil(write); else await write;
    return entry;
}

/** Stores `fleet` re-stamped as read now; its vehicles and plates are unchanged, so neither is serialized again. */
export async function restampCachedFleet(key: string, fleet: CachedFleet, lastUpdated: string, ttlS: number, waitUntil?: (promise: Promise<unknown>) => void): Promise<CachedFleet> {
    const entry = fleet.restamped(lastUpdated);
    const write = storeFleet(key, entry, ttlS);
    if (waitUntil) waitUntil(write); else await write;
    return entry;
}

async function storeFleet(key: string, entry: CachedFleet, ttlS: number, plates?: Record<string, string>): Promise<void> {
    inMemory.set(key, entry);
    const headers = new Headers({ 'Content-Type': 'application/json', [BUILT_AT_HEADER]: String(entry.builtAt) });
    if (entry.lastUpdated) headers.set(LAST_UPDATED_HEADER, entry.lastUpdated);
    if (entry.feedEtag) headers.set(FEED_ETAG_HEADER, entry.feedEtag);
    const tasks = [writeEdgeCache(cacheKey(key), new Response(entry.json, { headers }), ttlS)];
    if (plates) tasks.push(writeEdgeCache(platesKey(key), new Response(JSON.stringify(plates), { headers: { 'Content-Type': 'application/json' } }), ttlS));
    await Promise.all(tasks);
}
