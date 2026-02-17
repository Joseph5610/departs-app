import { Env, GolemioStopFeature } from "../_utils/types";
import { CACHE_TTL, TRANSIT_CONFIG, ERROR_MESSAGES, golemioFetch, createErrorResponse, createSuccessResponse } from "../_utils/api-utils";
import { processStops } from "../_utils/transit-utils";

/**
 * Endpoint for retrieving and processing all GTFS stops.
 * Fetches data in pages from Golemio API and processes them for map display.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    /**
     * Fetches all stops using pagination.
     */
    const fetchAllStops = async () => {
        let allFeatures: GolemioStopFeature[] = [];
        let offset = 0;
        const limit = TRANSIT_CONFIG.STOPS_FETCH_LIMIT;

        // Continue fetching until we hit the maximum offset or receive fewer features than the limit
        while (offset < TRANSIT_CONFIG.STOPS_MAX_OFFSET) {
            const res = await golemioFetch("/v2/gtfs/stops", env, {
                cacheTtl: CACHE_TTL.GTFS_DATA,
                searchParams: {
                    limit: limit.toString(),
                    offset: offset.toString()
                }
            });

            if (!res.ok) break;

            const data = await res.json() as { features: GolemioStopFeature[] };
            if (!data.features || data.features.length === 0) break;

            allFeatures = [...allFeatures, ...data.features];

            if (data.features.length < limit) break;
            offset += limit;
        }
        return allFeatures;
    };

    try {
        const allRawStops = await fetchAllStops();

        if (allRawStops.length === 0) {
            return createErrorResponse(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
        }

        // Transform and group stops for the frontend
        const features = processStops(allRawStops);

        return createSuccessResponse({
            type: "FeatureCollection",
            features
        }, CACHE_TTL.STOPS);
    } catch (error) {
        console.error("Stops API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
