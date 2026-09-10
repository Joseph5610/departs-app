import type { CityConfig } from '../../../../_core/city-config';
import type { AppStopCollection, AppStopFeature } from '../../../../_core/types';
import { ApiError, NotImplementedError } from '../../../../_core/errors';
import { ERROR_MESSAGES } from '../../../../_core/config';
import { StopsMapper } from './StopsMapper';
import { appClient } from '../../../../_core/ApiClient';

import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';

export class StopsService {
    constructor(public readonly city: CityConfig) {}

    async getStops(): Promise<AppStopCollection> {
        const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticDataUrl) {
            throw new NotImplementedError();
        }

        const cacheKey = `stops_${this.city.slug}`;
        // Double-tier caching strategy:
        // 1. CacheManager: In-memory cache for fast, concurrent access (2h TTL).
        // 2. caches.default: Cloudflare's edge cache for persistence across worker isolations (24h TTL).
        // If the in-memory cache expires, we fetch from the CF cache before hitting the upstream API.
        return CacheManager.getOrFetch(cacheKey, CACHE_TTL.TWO_HOURS_MS, async () => {
            const cache = caches.default;
            const jsonCacheKey = new Request(`https://departs.app/cache/${this.city.slug}/stops_v4`, { method: 'GET' });
            const cached = await cache.match(jsonCacheKey);
            
            if (cached) {
                return await cached.json();
            }
            
            const res = await appClient.fetch(`${staticDataUrl}/${this.city.slug}/stops.json`);
            if (!res.ok) {
                throw new ApiError(`${ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE} (upstream ${res.status})`, 502);
            }

            const data = await res.json();
            // Either a bare feature array or a FeatureCollection; anything else must not reach the mapper.
            const rawFeatures = Array.isArray(data)
                ? data as AppStopFeature[]
                : (data as { features?: AppStopFeature[] })?.features;

            if (!Array.isArray(rawFeatures)) {
                throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
            }

            const finalFeatures = StopsMapper.mapStops(rawFeatures);

            const result: AppStopCollection = {
                type: 'FeatureCollection',
                features: finalFeatures
            };

            const responseToCache = new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=86400' }
            });
            await cache.put(jsonCacheKey, responseToCache);
            
            return result;
        },
        // An empty stop set is an upstream failure, not a valid answer. Without this the empty
        // collection would be held for the full 2h TTL and the map would stay blank that whole time.
        (data) => !data || !data.features || data.features.length === 0);
    }
}
