import { createSource, type Snapshot } from '../../_core/feed/source';
import { appClient } from '../../_core/ApiClient';
import type { CityConfig } from '../../_core/city-config';
import { CACHE_TTL } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { decodeGtfsRtFeed, feedHeaderTimestamp, type GtfsRtFeed } from '../../_core/gtfsRtDecode';

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

/** The city's realtime feed URL; a city without one has no GTFS-RT feed to read. */
function realtimeUrlOf(city: CityConfig): string {
    const rtUrl = city.feed?.realtimeUrl;
    if (!rtUrl) throw new ApiError(`No realtimeUrl configured for city: ${city.slug}`, 501);
    return rtUrl;
}

/** Every read of the feed. Uncached: the stored fleet is the shared copy, and a cached feed (KORDIS sends max-age=86400) would be re-stamped as current. */
function fetchFeed(city: CityConfig, headers?: HeadersInit): Promise<Response> {
    return appClient.fetch(realtimeUrlOf(city), { cache: 'no-store', headers });
}

function sourceFor(city: CityConfig) {
    let source = sources.get(city.slug);
    if (source) return source;

    source = createSource<GtfsRtFeed>({
        key: `gtfs_rt_feed_${city.slug}`,
        // Matches how often clients poll and how often the edge revalidates; upstreams publish
        // every 20-30s, so a shorter window only repeats the same decode and assignment.
        ttlMs: CACHE_TTL.VEHICLES * 1000,
        isEmpty: (feed) => feed.entity.length === 0,
        read: async () => {
            const rtRes = await fetchFeed(city).catch((err) => {
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
    // Thrown here: inside the source a missing URL would read as a failed fetch.
    realtimeUrlOf(city);
    const snapshot = await sourceFor(city)();
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
    const res = await fetchFeed(city, { 'If-None-Match': etag });
    if (res.status === 304) return null;
    if (!res.ok) throw new ApiError(`GTFS-RT fetch failed for city: ${city.slug}`, 502);
    return { data: await decodeResponse(city, res), fetchedAt: Date.now() };
}

/** The decoded feed alone, for callers that do not care when it was read. */
export async function getGtfsRtFeed(city: CityConfig): Promise<GtfsRtFeed> {
    return (await getGtfsRtSnapshot(city)).data;
}

/**
 * The feed's alert entities, undecoded. Reuses this isolate's decoded feed when it is the current
 * download, else reads the download for alerts alone rather than decoding every vehicle in it.
 */
export async function getGtfsRtAlertEntities(city: CityConfig): Promise<Uint8Array[]> {
    const res = await fetchFeed(city);
    if (!res.ok) throw new ApiError(`GTFS-RT fetch failed for city: ${city.slug}`, 502);

    const bytes = new Uint8Array(await res.arrayBuffer());
    const previous = lastDecoded.get(city.slug);
    if (previous && isSameFeed(previous, bytes, feedHeaderTimestamp(bytes))) return previous.feed.alertEntities;
    return decodeGtfsRtFeed(bytes, { vehicles: false }).alertEntities;
}
