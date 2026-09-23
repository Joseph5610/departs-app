import { readEdgeCache, writeEdgeCache } from '../../_core/ApiClient';
import type { AppVehicleCollection } from '../../_core/types';

/**
 * The built fleet (decoded feed, every vehicle assigned to a trip), edge-cached so a fresh isolate
 * reads it instead of redoing that work. `_domain` builds it; this is the one place - in `_feeds`,
 * per the layering rule `_domain` never touches `ApiClient` directly - that reads or writes it.
 */
export interface CachedFleet {
    builtAt: number;
    collection: AppVehicleCollection;
}

function cacheKey(citySlug: string): string {
    return `vehicles_fleet_${citySlug}`;
}

/** The last build cached for `citySlug`, or null on a miss, a corrupt entry, or no Cache API. */
export async function readCachedFleet(citySlug: string): Promise<CachedFleet | null> {
    const res = await readEdgeCache(cacheKey(citySlug));
    if (!res) return null;
    try {
        return await res.json() as CachedFleet;
    } catch (e) {
        console.error(`Corrupt edge-cached fleet for ${citySlug}:`, e);
        return null;
    }
}

/** Stores a freshly built fleet for `ttlS` seconds. */
export async function writeCachedFleet(citySlug: string, collection: AppVehicleCollection, ttlS: number): Promise<void> {
    const entry: CachedFleet = { builtAt: Date.now(), collection };
    const body = new Response(JSON.stringify(entry), { headers: { 'Content-Type': 'application/json' } });
    await writeEdgeCache(cacheKey(citySlug), body, ttlS);
}
