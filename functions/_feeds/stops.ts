import { z } from 'zod';
import type { CityConfig } from '../_core/city-config';
import type { AppStopCollection } from '../_core/types';
import { appClient } from '../_core/ApiClient';
import { ApiError, NotImplementedError } from '../_core/errors';
import { ERROR_MESSAGES } from '../_core/config';
import { CacheManager, MEMORY_CACHE_TTL } from '../_core/feed/CacheManager';

/** Shape check only: a per-feature schema over tens of thousands of stops costs more CPU than a request has. */
const mapStopsSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.unknown()).min(1),
});

/**
 * A city's final stop list, prebuilt by departs-data as `<city>/map-stops.json`.
 * The Worker never groups or enriches stops itself; it passes the file through or reads it for MCP and the sitemap.
 */
export class MapStopsService {
    constructor(private readonly city: CityConfig) {}

    /** The stop list as objects, for server-side readers (MCP tools, sitemap). */
    async getStops(): Promise<AppStopCollection> {
        const url = this.fileUrl();
        return CacheManager.getOrFetch(`map_stops_${this.city.slug}`, MEMORY_CACHE_TTL.TWO_HOURS_MS, async () => {
            const res = await this.fetchFile(url);
            const parsed = mapStopsSchema.safeParse(await res.json());
            if (!parsed.success) {
                throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
            }
            return parsed.data as AppStopCollection;
        });
    }

    /** The stop file's body, streamed through without parsing. */
    async getStopsBody(): Promise<ReadableStream> {
        const res = await this.fetchFile(this.fileUrl());
        if (!res.body) {
            throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
        }
        return res.body;
    }

    private async fetchFile(url: string): Promise<Response> {
        // Follows the file's own Cache-Control, so a data rebuild shows up within minutes.
        const res = await appClient.fetch(url, { cf: { cacheEverything: true } });
        if (!res.ok) {
            throw new ApiError(`${ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE} (upstream ${res.status})`, 502);
        }
        return res;
    }

    private fileUrl(): string {
        const staticDataUrl = this.city.feed?.staticDataUrl;
        if (!staticDataUrl) {
            throw new NotImplementedError();
        }
        return `${staticDataUrl}/${this.city.slug}/map-stops.json`;
    }
}
