import { Env } from "../_utils/types";
import { CACHE_TTL, TRANSIT_CONFIG, ERROR_MESSAGES, golemioFetch, createErrorResponse, createSuccessResponse } from "../_utils/api-utils";
import { processStops } from "../_utils/transit-utils";

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    const fetchAllStops = async () => {
        let allFeatures: any[] = [];
        let offset = 0;
        const limit = TRANSIT_CONFIG.STOPS_FETCH_LIMIT;

        while (offset < TRANSIT_CONFIG.STOPS_MAX_OFFSET) {
            const res = await golemioFetch("/v2/gtfs/stops", env, {
                cacheTtl: CACHE_TTL.GTFS_DATA,
                searchParams: {
                    limit: limit.toString(),
                    offset: offset.toString()
                }
            });

            if (!res.ok) break;
            const data = await res.json() as { features: any[] };
            if (!data.features || data.features.length === 0) break;

            allFeatures = [...allFeatures, ...data.features];
            if (data.features.length < limit) break;
            offset += limit;
        }
        return allFeatures;
    };

    try {
        const all = await fetchAllStops();
        if (all.length === 0) return createErrorResponse(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);

        const features = processStops(all);

        return createSuccessResponse({ type: "FeatureCollection", features }, CACHE_TTL.STOPS);
    } catch {
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
