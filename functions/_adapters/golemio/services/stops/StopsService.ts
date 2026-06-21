
import { Env, AppStopCollection } from "../../../../_core/types";
import { GolemioStopFeature, golemioStopPayloadSchema } from "./schemas";
import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GOLEMIO_CONFIG } from "../../core/config";
import { GolemioClient } from "../../core/GolemioClient";
import { processStops } from "./grouping";
import { StopsMapper } from "./StopsMapper";

/**
 * Service for fetching and processing physical transit stops.
 * Handles grouping logic (e.g. merging nodes into stations) and enrichment.
 */
export class StopsService {
    constructor(private client: GolemioClient) {}

    /**
     * Fetches all stops from the Golemio API and processes them.
     * Uses pagination/offsets under the hood if multiple chunks are required.
     * 
     * @param {Env} env - The environment configuration
     * @returns {Promise<AppStopCollection>} Object containing a FeatureCollection of grouped and enriched stop features
     */
    async getStops(env: Env): Promise<AppStopCollection> {

        const fetchAllGolemioStops = async (): Promise<GolemioStopFeature[]> => {
            const limit = GOLEMIO_CONFIG.STOPS_FETCH_LIMIT;
            const maxOffset = GOLEMIO_CONFIG.STOPS_MAX_OFFSET;
            const pageCount = Math.ceil(maxOffset / limit);
            const offsets = Array.from({ length: pageCount }, (_, i) => i * limit);
            const results = await Promise.all(offsets.map(async (offset) => {
                const res = await this.client.fetch("/v2/gtfs/stops", env, {
                    cacheTtl: CACHE_TTL.GTFS_DATA,
                    searchParams: { limit: limit.toString(), offset: offset.toString() }
                });
                if (!res.ok) return [];
                const rawData = await res.json();
                const parsed = golemioStopPayloadSchema.safeParse(rawData);
                if (!parsed.success) {
                    console.error("Critical Golemio stops structural change:", parsed.error);
                    return [];
                }
                const features = parsed.data.features;
                return features.filter((f): f is NonNullable<typeof f> => f !== null);
            }));
            return results.flat();
        };

            const allRawStops = await fetchAllGolemioStops();
            if (allRawStops.length === 0) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);

            // Enrich raw Golemio stops → AppStopFeature[] (adds lines, names from our enrichment data)
            const enrichedStops = StopsMapper.map(allRawStops);

            const features = processStops(enrichedStops);
            return { type: "FeatureCollection", features };
    }
}
