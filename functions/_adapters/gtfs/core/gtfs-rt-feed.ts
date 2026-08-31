import { transit_realtime } from 'gtfs-realtime-bindings';
import { CacheManager, CACHE_TTL } from '../../../_core/utils/CacheManager';
import { appClient } from '../../../_core/ApiClient';
import type { CityConfig } from '../../../_core/city-config';
import { ApiError } from '../../../_core/errors';

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
        CACHE_TTL.SHORT_DEBOUNCE_MS, // 3 seconds internal debounce
        async () => {
            const t0 = Date.now();
            const rtRes = await appClient.fetch(rtUrl, { cf: { cacheTtl: 3 } }).catch((err) => {
                console.warn(`[GTFS-RT] Fetch error for ${city.slug}:`, err?.message || err);
                return null;
            });
            if (!rtRes || !rtRes.ok) {
                console.warn(`[GTFS-RT] Failed to fetch feed for ${city.slug}: ${rtRes?.status}`);
                return null;
            }

            const t1 = Date.now();
            const buffer = await rtRes.arrayBuffer();
            const t2 = Date.now();
            const decoded = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
            const t3 = Date.now();
            
            console.log(`[PERF] ${city.slug} GTFS-RT: fetch=${t1-t0}ms, buffer=${t2-t1}ms, decode=${t3-t2}ms, total=${t3-t0}ms`);
            
            return decoded;
        },
        (feed) => !feed || !feed.entity || feed.entity.length === 0
    );

    if (!feed) {
        throw new ApiError(`GTFS-RT fetch failed for city: ${city.slug}`, 502);
    }

    return feed;
}
