import { Env, GolemioAirQualityFeature } from "../_utils/types";
import { CACHE_TTL, golemioFetch, createErrorResponse, createSuccessResponse, ERROR_MESSAGES } from "../_utils/api-utils";

/**
 * Endpoint for retrieving CHMI Air Quality stations and their measurements.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    try {
        // Fetch current air quality data for all stations
        const res = await golemioFetch("/v2/airqualitystations", env, {
            cacheTtl: CACHE_TTL.AIR_QUALITY
        });

        if (!res.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(res.status), res.status);
        }

        const data = await res.json() as { features: GolemioAirQualityFeature[] };

        // We return the raw features - frontend will calculate proximity and display the nearest
        return createSuccessResponse({
            type: "FeatureCollection",
            features: data.features || []
        }, CACHE_TTL.AIR_QUALITY);

    } catch (error) {
        console.error("Air Quality API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
