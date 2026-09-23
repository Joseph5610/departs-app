import { createSource, type Snapshot } from '../../_core/feed/source';
import { appClient } from '../../_core/ApiClient';
import type { CityConfig } from '../../_core/city-config';
import { CACHE_TTL, UPSTREAM_TTL_S } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { decodeGtfsRtFeed, type GtfsRtFeed } from './gtfs-rt-decode';

/** The last decoded feed per city with its raw bytes, so an unchanged download is not decoded again. */
const lastDecoded = new Map<string, { bytes: Uint8Array; feed: GtfsRtFeed }>();

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

const sources = new Map<string, () => Promise<Snapshot<GtfsRtFeed> | null>>();

function sourceFor(city: CityConfig, rtUrl: string) {
    let source = sources.get(city.slug);
    if (source) return source;

    source = createSource<GtfsRtFeed>({
        key: `gtfs_rt_feed_${city.slug}`,
        // Matches how often clients poll and how often the edge revalidates; upstreams publish
        // every 20-30s, so a shorter window only repeats the same decode and assignment.
        ttlMs: CACHE_TTL.VEHICLES * 1000,
        isEmpty: (feed) => feed.entity.length === 0,
        read: async () => {
            // `cacheTtl` (top-level) puts this through ApiClient's explicit caches.default path, which
            // survives an isolate eviction; `cf.cacheTtl` alone is only a same-zone hint and does not.
            const rtRes = await appClient.fetch(rtUrl, { cacheTtl: UPSTREAM_TTL_S.GTFS_RT_FEED, cf: { cacheTtl: UPSTREAM_TTL_S.GTFS_RT_FEED } }).catch((err) => {
                console.warn(`[GTFS-RT] Fetch error for ${city.slug}:`, err?.message || err);
                return null;
            });
            if (!rtRes || !rtRes.ok) {
                console.warn(`[GTFS-RT] Failed to fetch feed for ${city.slug}: ${rtRes?.status}`);
                return null;
            }

            // Upstreams publish less often than the debounce refetches; decoding is the expensive part.
            const bytes = new Uint8Array(await rtRes.arrayBuffer());
            const previous = lastDecoded.get(city.slug);
            if (previous && sameBytes(previous.bytes, bytes)) return previous.feed;

            const decoded = decodeGtfsRtFeed(bytes);
            lastDecoded.set(city.slug, { bytes, feed: decoded });
            return decoded;
        },
    });
    sources.set(city.slug, source);
    return source;
}

/** The city's realtime feed as a snapshot: the decoded message and when it was read. */
export async function getGtfsRtSnapshot(city: CityConfig): Promise<Snapshot<GtfsRtFeed>> {
    const rtUrl = city.feed?.realtimeUrl;
    if (!rtUrl) {
        throw new ApiError(`No realtimeUrl configured for city: ${city.slug}`, 501);
    }

    const snapshot = await sourceFor(city, rtUrl)();
    if (!snapshot) {
        throw new ApiError(`GTFS-RT fetch failed for city: ${city.slug}`, 502);
    }
    return snapshot;
}

/** The decoded feed alone, for callers that do not care when it was read. */
export async function getGtfsRtFeed(city: CityConfig): Promise<GtfsRtFeed> {
    return (await getGtfsRtSnapshot(city)).data;
}
