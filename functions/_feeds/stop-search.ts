import { z } from 'zod';
import type { CityConfig } from '../_core/city-config';
import type { AppStopFeature } from '../_core/types';
import { appClient } from '../_core/ApiClient';
import { ApiError, NotImplementedError } from '../_core/errors';
import { ERROR_MESSAGES, STOP_SEARCH_CONFIG } from '../_core/config';
import { CacheManager, MEMORY_CACHE_TTL } from '../_core/feed/CacheManager';
import { LruCache } from '../_core/feed/LruCache';
import { distanceMeters } from '../_core/utils/geo';

/** Lowercase without diacritics, so `namesti svobody` finds `Náměstí Svobody`. Must match departs-data's `foldName`. */
const foldName = (value: string): string => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Shape check only: `stopFeatures` type-checks the fields of the few stops it reads. */
const stopDetailsBlockSchema = z.array(z.array(z.unknown()));
type StopDetailsBlock = z.infer<typeof stopDetailsBlockSchema>;

type StopLine = NonNullable<AppStopFeature['properties']['lines']>[number];

const isStopLine = (value: unknown): value is StopLine => {
    if (typeof value !== 'object' || value === null) return false;
    const line = value as Record<string, unknown>;
    return typeof line.name === 'string' && typeof line.route_color === 'string' && (typeof line.type === 'string' || typeof line.type === 'number');
};

export interface RankedStopIndex {
    index: number;
    /** Approximate until the stop's detail is read; `stopFeatures` callers recompute it from full coordinates. */
    distance: number;
}

const EARTH_M_PER_DEG = 6_371_000 * Math.PI / 180;

/**
 * A city's stops as departs-data's `stop_search.*` files lay them out: a text of folded names
 * searched with native `indexOf`, and coordinates in typed arrays. Nothing here parses the stop list,
 * which for Prague alone cost several times a request's CPU budget.
 */
export class StopSearch {
    private readonly count: number;
    private readonly offsets: Uint32Array;
    private readonly lon: Float32Array;
    private readonly lat: Float32Array;
    private readonly flags: Uint8Array;

    constructor(private readonly text: string, bin: ArrayBuffer) {
        const count = new Uint32Array(bin, 0, 1)[0];
        const expected = 4 + (count + 1) * 4 + count * 8 + count;
        if (bin.byteLength !== expected) throw new Error(`stop_search.bin is ${bin.byteLength} bytes, expected ${expected}`);

        this.count = count;
        this.offsets = new Uint32Array(bin, 4, count + 1);
        this.lon = new Float32Array(bin, 4 + (count + 1) * 4, count);
        this.lat = new Float32Array(bin, 4 + (count + 1) * 4 + count * 4, count);
        this.flags = new Uint8Array(bin, 4 + (count + 1) * 4 + count * 8, count);
        if (this.offsets[count] !== text.length) throw new Error('stop_search.txt and stop_search.bin come from different builds');
    }

    isCentroid(index: number): boolean {
        return (this.flags[index] & 1) !== 0;
    }

    /** The search line holding text position `pos`. */
    private lineAt(pos: number): number {
        let lo = 0;
        let hi = this.count - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (this.offsets[mid] <= pos) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    /** A line's folded name; empty for centroids. */
    foldedName(index: number): string {
        const start = this.offsets[index];
        const end = this.offsets[index + 1] - 1;
        const tab = this.text.indexOf('\t', start);
        return tab === -1 || tab >= end ? '' : this.text.slice(start, tab);
    }

    /**
     * Non-centroid stops whose name or id contains `query`, best match first: exact name, then name
     * starting with it, then any containment, then id containment; shorter names win ties, then stop order.
     */
    byName(query: string, limit: number): number[] {
        const q = foldName(query);
        // Names and ids never hold a tab or newline, so such a query matches nothing, as a field-by-field search would.
        if (!q || q.includes('\t') || q.includes('\n')) return [];

        const indexes: number[] = [];
        const keys: number[] = [];
        let pos = this.text.indexOf(q);
        while (pos !== -1) {
            const i = this.lineAt(pos);
            const start = this.offsets[i];
            const tab = this.text.indexOf('\t', start);
            if (tab !== -1 && tab < this.offsets[i + 1]) {
                // `pos` is the line's first match, so where it lands decides the rank without slicing the line.
                const nameLength = tab - start;
                const rank = pos === start ? (nameLength === q.length ? 0 : 1) : pos + q.length <= tab ? 2 : 3;
                indexes.push(i);
                keys.push(rank * STOP_SEARCH_CONFIG.MAX_KEYED_NAME_LENGTH + Math.min(nameLength, STOP_SEARCH_CONFIG.MAX_KEYED_NAME_LENGTH - 1));
            }
            pos = this.text.indexOf(q, this.offsets[i + 1]);
        }

        // Matches are found in stop order, so the position in `indexes` breaks ties the way a stable sort would.
        const order = new Float64Array(indexes.length);
        for (let k = 0; k < indexes.length; k++) order[k] = keys[k] * indexes.length + k;
        order.sort();
        const ranked: number[] = [];
        for (let k = 0; k < order.length && ranked.length < limit; k++) ranked.push(indexes[order[k] % indexes.length]);
        return ranked;
    }

    /** Non-centroid stops whose folded name is exactly `folded`, in stop order. */
    withFoldedName(folded: string): number[] {
        const found: number[] = [];
        const needle = `\n${folded}\t`;
        if (this.text.startsWith(needle.slice(1))) found.push(0);
        let pos = this.text.indexOf(needle);
        while (pos !== -1) {
            found.push(this.lineAt(pos + 1));
            pos = this.text.indexOf(needle, pos + 1);
        }
        return found;
    }

    /**
     * The `limit` stops nearest to a point within `radiusM`, nearest first. Ranked on a flat projection,
     * which at a city's scale orders stops as the haversine does; callers read exact distances off the details.
     */
    nearest(lat: number, lon: number, { includeCentroids = false, radiusM = Infinity, limit }: { includeCentroids?: boolean; radiusM?: number; limit: number }): RankedStopIndex[] {
        if (limit <= 0) return [];
        const kx = Math.cos(lat * Math.PI / 180) * EARTH_M_PER_DEG;
        const maxSq = radiusM === Infinity ? Infinity : (radiusM * STOP_SEARCH_CONFIG.RADIUS_MARGIN) ** 2;

        const best: RankedStopIndex[] = [];
        for (let i = 0; i < this.count; i++) {
            if (!includeCentroids && (this.flags[i] & 1) !== 0) continue;
            const dx = (this.lon[i] - lon) * kx;
            const dy = (this.lat[i] - lat) * EARTH_M_PER_DEG;
            const sq = dx * dx + dy * dy;
            if (sq > maxSq || (best.length === limit && sq >= best[limit - 1].distance)) continue;

            let at = best.length === limit ? limit - 1 : best.length;
            while (at > 0 && best[at - 1].distance > sq) {
                best[at] = best[at - 1];
                at--;
            }
            best[at] = { index: i, distance: sq };
        }
        for (const entry of best) entry.distance = distanceMeters(lat, lon, this.lat[entry.index], this.lon[entry.index]);
        return best.filter(entry => entry.distance <= radiusM);
    }
}

function staticDataUrl(city: CityConfig): string {
    const url = city.feed?.staticDataUrl;
    if (!url) throw new NotImplementedError();
    return `${url}/${city.slug}`;
}

async function fetchFile(url: string): Promise<Response> {
    // Follows the file's own Cache-Control, so a data rebuild shows up within minutes.
    const res = await appClient.fetch(url, { cf: { cacheEverything: true } });
    if (!res.ok) throw new ApiError(`${ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE} (upstream ${res.status})`, 502);
    return res;
}

/** The city's stop search index, read once per isolate every two hours. */
export function getStopSearch(city: CityConfig): Promise<StopSearch> {
    const base = staticDataUrl(city);
    return CacheManager.getOrFetch(`stop_search_${city.slug}`, MEMORY_CACHE_TTL.TWO_HOURS_MS, async () => {
        const [text, bin] = await Promise.all([
            fetchFile(`${base}/stop_search.txt`).then(res => res.text()),
            fetchFile(`${base}/stop_search.bin`).then(res => res.arrayBuffer()),
        ]);
        return new StopSearch(text, bin);
    });
}

const detailBlocks = new LruCache<StopDetailsBlock>({
    maxEntries: STOP_SEARCH_CONFIG.DETAILS_CACHE_MAX_ENTRIES,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS,
});

async function detailsBlock(city: CityConfig, blockId: number): Promise<StopDetailsBlock> {
    const key = `${city.slug}:${blockId}`;
    const held = detailBlocks.get(key);
    if (held) return held;

    const res = await fetchFile(`${staticDataUrl(city)}/stop_details/${blockId}.json`);
    const parsed = stopDetailsBlockSchema.safeParse(await res.json());
    if (!parsed.success) throw new ApiError(ERROR_MESSAGES.DATA_STRUCTURE_CHANGED, 502);
    detailBlocks.set(key, parsed.data);
    return parsed.data;
}

/** The given stops as features, read from only the detail blocks that hold them. */
export async function stopFeatures(city: CityConfig, search: StopSearch, indexes: number[]): Promise<Map<number, AppStopFeature>> {
    const blockIds = new Set(indexes.map(i => Math.floor(i / STOP_SEARCH_CONFIG.DETAILS_BLOCK)));
    const blocks = new Map<number, StopDetailsBlock>();
    await Promise.all([...blockIds].map(async (id) => { blocks.set(id, await detailsBlock(city, id)); }));

    const features = new Map<number, AppStopFeature>();
    for (const index of indexes) {
        const detail = blocks.get(Math.floor(index / STOP_SEARCH_CONFIG.DETAILS_BLOCK))?.[index % STOP_SEARCH_CONFIG.DETAILS_BLOCK];
        if (!detail) continue;
        const [stopId, stopName, platformCode, locationType, lon, lat, lines] = detail;
        if (typeof stopId !== 'string' || typeof stopName !== 'string' || typeof lon !== 'number' || typeof lat !== 'number') continue;
        features.set(index, {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lon, lat] },
            properties: {
                stop_id: stopId,
                stop_name: stopName,
                platform_code: typeof platformCode === 'string' ? platformCode : null,
                location_type: typeof locationType === 'number' || typeof locationType === 'string' ? locationType : 0,
                parent_station: null,
                zone_id: null,
                is_centroid: search.isCentroid(index),
                // The stop data carries GTFS route type codes here; `toMcpStopLines` normalizes them.
                lines: Array.isArray(lines) ? lines.filter(isStopLine) : [],
            },
        });
    }
    return features;
}

/** The city's sitemap stop ids, one URL-encoded id per line; empty when the file cannot be read. */
export async function getSitemapStopIds(city: CityConfig): Promise<string> {
    const res = await fetchFile(`${staticDataUrl(city)}/sitemap_stops.txt`);
    return res.text();
}
