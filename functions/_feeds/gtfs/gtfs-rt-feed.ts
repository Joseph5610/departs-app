import { createSource, type Snapshot } from '../../_core/feed/source';
import { appClient } from '../../_core/ApiClient';
import type { CityConfig } from '../../_core/city-config';
import { CACHE_TTL, UPSTREAM_TTL_S } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { decodeGtfsRtFeed, feedHeaderTimestamp, type GtfsRtFeed } from './gtfs-rt-decode';

/** The last decoded feed per city with its raw bytes, so an unchanged download is not decoded again. */
const lastDecoded = new Map<string, { bytes: Uint8Array; headerTimestamp: number | undefined; feed: GtfsRtFeed }>();

/** Whether a download is the one already decoded: by header timestamp when the feed stamps one, else byte for byte. */
function isSameFeed(previous: { bytes: Uint8Array; headerTimestamp: number | undefined }, bytes: Uint8Array, headerTimestamp: number | undefined): boolean {
    if (previous.bytes.length !== bytes.length) return false;
    if (headerTimestamp !== undefined) return previous.headerTimestamp === headerTimestamp;
    for (let i = 0; i < bytes.length; i++) if (previous.bytes[i] !== bytes[i]) return false;
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
            // No edge copy (`cacheTtl`): fresh isolates share the stored fleet built from this feed, and a raw copy expires before the next rebuild reads it.
            const rtRes = await appClient.fetch(rtUrl, { cf: { cacheTtl: UPSTREAM_TTL_S.GTFS_RT_FEED } }).catch((err) => {
                console.warn(`[GTFS-RT] Fetch error for ${city.slug}:`, err?.message || err);
                return null;
            });
            if (!rtRes || !rtRes.ok) {
                console.warn(`[GTFS-RT] Failed to fetch feed for ${city.slug}: ${rtRes?.status}`);
                return null;
            }

            // Upstreams publish less often than the debounce refetches; decoding is the expensive part.
            const bytes = new Uint8Array(await rtRes.arrayBuffer());
            const headerTimestamp = feedHeaderTimestamp(bytes);
            const previous = lastDecoded.get(city.slug);
            if (previous && isSameFeed(previous, bytes, headerTimestamp)) return previous.feed;

            const decoded = decodeGtfsRtFeed(bytes);
            decoded.headerTimestamp = headerTimestamp;
            lastDecoded.set(city.slug, { bytes, headerTimestamp, feed: decoded });
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
