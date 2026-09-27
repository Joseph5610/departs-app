import { createSource, type Snapshot } from '../../_core/feed/source';
import { appClient } from '../../_core/ApiClient';
import type { CityConfig } from '../../_core/city-config';
import { CACHE_TTL } from '../../_core/config';
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

/** A downloaded feed, decoded unless it is the publication this isolate decoded last. */
async function decodeResponse(city: CityConfig, res: Response): Promise<GtfsRtFeed> {
    const bytes = new Uint8Array(await res.arrayBuffer());
    const headerTimestamp = feedHeaderTimestamp(bytes);
    const previous = lastDecoded.get(city.slug);
    if (previous && isSameFeed(previous, bytes, headerTimestamp)) return previous.feed;

    const decoded = decodeGtfsRtFeed(bytes);
    decoded.etag = res.headers.get('etag') ?? undefined;
    lastDecoded.set(city.slug, { bytes, headerTimestamp, feed: decoded });
    return decoded;
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
            // Uncached: the stored fleet is the shared copy, and a cached feed (KORDIS sends max-age=86400) would be re-stamped as current.
            const rtRes = await appClient.fetch(rtUrl, { cache: 'no-store' }).catch((err) => {
                console.warn(`[GTFS-RT] Fetch error for ${city.slug}:`, err?.message || err);
                return null;
            });
            if (!rtRes || !rtRes.ok) {
                console.warn(`[GTFS-RT] Failed to fetch feed for ${city.slug}: ${rtRes?.status}`);
                return null;
            }

            return decodeResponse(city, rtRes);
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

/**
 * The city's feed unless it is still the publication with `etag`, asked conditionally: an unchanged feed
 * is neither downloaded nor decoded (null), a changed one is read once and returned. Throws when unreadable.
 */
export async function getGtfsRtSnapshotIfChanged(city: CityConfig, etag: string): Promise<Snapshot<GtfsRtFeed> | null> {
    const rtUrl = city.feed?.realtimeUrl;
    if (!rtUrl) throw new ApiError(`No realtimeUrl configured for city: ${city.slug}`, 501);
    const res = await appClient.fetch(rtUrl, { cache: 'no-store', headers: { 'If-None-Match': etag } });
    if (res.status === 304) return null;
    if (!res.ok) throw new ApiError(`GTFS-RT fetch failed for city: ${city.slug}`, 502);
    return { data: await decodeResponse(city, res), fetchedAt: Date.now() };
}

/** The decoded feed alone, for callers that do not care when it was read. */
export async function getGtfsRtFeed(city: CityConfig): Promise<GtfsRtFeed> {
    return (await getGtfsRtSnapshot(city)).data;
}
