import { Env, GolemioBicycleCounterFeature } from "../_utils/types";
import { CACHE_TTL, golemioFetch, createErrorResponse, createSuccessResponse, ERROR_MESSAGES } from "../_utils/api-utils";

/**
 * Endpoint for retrieving bicycle counter stations and their recent activity.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    try {
        // Fetch all bicycle counters
        const res = await golemioFetch("/v2/bicyclecounters", env, {
            cacheTtl: CACHE_TTL.BICYCLE_COUNTERS,
            searchParams: { limit: "1000" } // Sensible default limit
        });

        if (!res.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(res.status), res.status);
        }

        const data = await res.json() as { features: GolemioBicycleCounterFeature[] };

        // Return features
        return createSuccessResponse({
            type: "FeatureCollection",
            features: data.features || []
        }, CACHE_TTL.BICYCLE_COUNTERS);

    } catch (error) {
        console.error("Bicycle Counter API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
