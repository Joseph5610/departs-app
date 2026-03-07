import { Env, GolemioSharedCarFeature } from "../_utils/types";
import { CACHE_TTL, golemioFetch, createErrorResponse, createSuccessResponse, ERROR_MESSAGES } from "../_utils/api-utils";

/**
 * Endpoint for retrieving shared car locations.
 * Uses the v2 API marked as deprecated but still active as open data.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    try {
        // Fetch all shared cars
        const res = await golemioFetch("/v2/sharedcars", env, {
            cacheTtl: CACHE_TTL.SHARED_CARS,
            searchParams: { limit: "1000" } // Sensible default limit
        });

        if (!res.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(res.status), res.status);
        }

        const data = await res.json() as { features: GolemioSharedCarFeature[] };

        // Normalize and return features
        const features = (data.features || []).map(f => ({
            type: "Feature",
            geometry: f.geometry,
            properties: {
                id: f.properties.id,
                name: f.properties.name,
                company: f.properties.company?.name || "Unknown",
                updated_at: f.properties.updated_at
            }
        }));

        return createSuccessResponse({
            type: "FeatureCollection",
            features
        }, CACHE_TTL.SHARED_CARS);

    } catch (error) {
        console.error("Shared Cars API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
