import { readEdgeCache, writeEdgeCache } from '../../_core/ApiClient';
import type { AppVehicleCollection } from '../../_core/types';
import { GTFS_CONFIG } from './config';

/**
 * The built fleet (decoded feed, every vehicle assigned to a trip), kept serialized so the map's
 * unfiltered request can be answered without parsing it. `_domain` builds it; this is the one place -
 * in `_feeds`, per the layering rule `_domain` never touches `ApiClient` directly - that reads or writes it.
 */
export class CachedFleet {
    private parsed: AppVehicleCollection | undefined;

    /** `json` is the collection without `status`, which is stamped per request from `lastUpdated`. */
    constructor(
        readonly builtAt: number,
        readonly json: string,
        readonly lastUpdated: string | undefined,
        parsed?: AppVehicleCollection
    ) {
        this.parsed = parsed;
    }

    /** The collection, parsed on first use. Shared by every request in the isolate: never mutate it. */
    get collection(): AppVehicleCollection {
        this.parsed ??= JSON.parse(this.json) as AppVehicleCollection;
        return this.parsed;
    }
}

const BUILT_AT_HEADER = 'X-Fleet-Built-At';
const LAST_UPDATED_HEADER = 'X-Fleet-Last-Updated';

/** This isolate's newest build per city, so a warm isolate skips both the Cache API and the parse. */
const inMemory = new Map<string, CachedFleet>();

function cacheKey(citySlug: string): string {
    return `vehicles_fleet_${citySlug}`;
}

async function readEdgeFleet(citySlug: string): Promise<CachedFleet | null> {
    const res = await readEdgeCache(cacheKey(citySlug));
    if (!res) return null;
    const builtAt = Number(res.headers.get(BUILT_AT_HEADER));
    if (!Number.isFinite(builtAt) || builtAt <= 0) return null;
    return new CachedFleet(builtAt, await res.text(), res.headers.get(LAST_UPDATED_HEADER) ?? undefined);
}

/**
 * The newest build cached for `citySlug`: this isolate's own while fresh, else whichever of it and the
 * edge copy (possibly rebuilt by another isolate) is newer. Null on a miss or with no Cache API.
 */
export async function readCachedFleet(citySlug: string): Promise<CachedFleet | null> {
    const local = inMemory.get(citySlug);
    if (local && Date.now() - local.builtAt < GTFS_CONFIG.FLEET_CACHE_FRESH_MS) return local;

    const edge = await readEdgeFleet(citySlug);
    const newest = edge && (!local || edge.builtAt > local.builtAt) ? edge : local ?? null;
    if (newest) inMemory.set(citySlug, newest);
    return newest;
}

/** Stores a freshly built fleet in this isolate and at the edge for `ttlS` seconds. */
export async function writeCachedFleet(citySlug: string, collection: AppVehicleCollection, ttlS: number): Promise<CachedFleet> {
    const json = JSON.stringify({ ...collection, status: undefined });
    const entry = new CachedFleet(Date.now(), json, collection.last_updated, { ...collection, status: undefined });
    inMemory.set(citySlug, entry);

    const headers = new Headers({ 'Content-Type': 'application/json', [BUILT_AT_HEADER]: String(entry.builtAt) });
    if (entry.lastUpdated) headers.set(LAST_UPDATED_HEADER, entry.lastUpdated);
    await writeEdgeCache(cacheKey(citySlug), new Response(json, { headers }), ttlS);
    return entry;
}
