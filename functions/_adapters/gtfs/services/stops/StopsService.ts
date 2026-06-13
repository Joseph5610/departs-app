import type { CityConfig } from '../../../../_core/city-config';
import type { AppStopCollection, AppStopFeature } from '../../../../_core/types';
import { NotImplementedError } from '../../../../_core/errors';
import { StopsMapper } from './StopsMapper';

export class StopsService {
    constructor(private city: CityConfig) {}

    async getStops(): Promise<AppStopCollection> {
        const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticDataUrl) {
            throw new NotImplementedError();
        }

        const cache = caches.default;
        const jsonCacheKey = new Request(`https://departs.app/cache/${this.city.slug}/stops_v1`, { method: 'GET' });
        const cached = await cache.match(jsonCacheKey);
        if (cached) {
            return cached.json();
        }

        const res = await fetch(`${staticDataUrl}/${this.city.slug}/stops.json`);
        const data = await res.json();
        const rawFeatures = Array.isArray(data) ? data as AppStopFeature[] : (data as { features: AppStopFeature[] }).features;

        const finalFeatures = StopsMapper.mapStops(rawFeatures);

        const result: AppStopCollection = {
            type: 'FeatureCollection',
            features: finalFeatures
        };

        const responseToCache = new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=86400' }
        });
        // We await put since we don't have ctx.waitUntil here, but it's acceptable for a background cache warm
        await cache.put(jsonCacheKey, responseToCache);

        return result;
    }
}
