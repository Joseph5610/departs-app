import { transit_realtime } from 'gtfs-realtime-bindings';
import { CacheManager, MEMORY_CACHE_TTL } from '../../../_core/utils/CacheManager';
import { appClient } from '../../../_core/ApiClient';
import type { CityConfig } from '../../../_core/city-config';
import { UPSTREAM_TTL_S } from '../../../_core/config';
import { ApiError } from '../../../_core/errors';

/** The last decoded feed per city with its raw bytes, so an unchanged download is not decoded again. */
const lastDecoded = new Map<string, { bytes: Uint8Array; feed: transit_realtime.FeedMessage }>();

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

/**
 * Fetches, decodes, and caches the GTFS-RT FeedMessage for a given city.
 * This ensures that both AlertsService and VehiclesService share the same 
 * decoded feed and do not redundantly download/decode the Protobuf stream.
 */
export async function getGtfsRtFeed(city: CityConfig): Promise<transit_realtime.FeedMessage> {
    const rtUrl = city.adapterConfig?.realtimeUrl;
    if (!rtUrl) {
        throw new ApiError(`No realtimeUrl configured for city: ${city.slug}`, 501);
    }

    const feed = await CacheManager.getOrFetch<transit_realtime.FeedMessage | null>(
        `gtfs_rt_feed_${city.slug}`,
        MEMORY_CACHE_TTL.SHORT_DEBOUNCE_MS, // short internal debounce, shared by alerts and vehicles
        async () => {
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
            const previous = lastDecoded.get(city.slug);
            if (previous && sameBytes(previous.bytes, bytes)) return previous.feed;

            const decoded = transit_realtime.FeedMessage.decode(bytes);
            lastDecoded.set(city.slug, { bytes, feed: decoded });
            return decoded;
        },
        (feed) => !feed || !feed.entity || feed.entity.length === 0
    );

    if (!feed) {
        throw new ApiError(`GTFS-RT fetch failed for city: ${city.slug}`, 502);
    }

    return feed;
}
