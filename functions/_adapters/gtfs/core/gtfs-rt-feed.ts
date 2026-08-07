import { transit_realtime } from 'gtfs-realtime-bindings';
import { CacheManager } from '../../../_core/utils/CacheManager';
import { appClient } from '../../../_core/ApiClient';

/**
 * Fetches, decodes, and caches the GTFS-RT FeedMessage for a given city.
 * This ensures that both AlertsService and VehiclesService share the same 
 * decoded feed and do not redundantly download/decode the Protobuf stream.
 */
export async function getGtfsRtFeed(citySlug: string, rtUrl: string): Promise<transit_realtime.FeedMessage | null> {
    return CacheManager.getOrFetch<transit_realtime.FeedMessage | null>(
        `gtfs_rt_feed_${citySlug}`,
        10000, // 10 seconds TTL
        async () => {
            const rtRes = await appClient.fetch(rtUrl, { cf: { cacheTtl: 10 } }).catch((err) => {
                console.warn(`[GTFS-RT] Fetch error for ${citySlug}:`, err?.message || err);
                return null;
            });
            if (!rtRes || !rtRes.ok) {
                console.warn(`[GTFS-RT] Failed to fetch feed for ${citySlug}: ${rtRes?.status}`);
                return null;
            }

            const buffer = await rtRes.arrayBuffer();
            return transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
        },
        (feed) => !feed || !feed.entity || feed.entity.length === 0
    );
}
