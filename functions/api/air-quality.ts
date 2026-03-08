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

        // Flatten features for easier MapLibre rendering
        const features = (data.features || []).map(f => ({
            type: "Feature",
            geometry: f.geometry,
            properties: {
                id: f.properties.id,
                name: f.properties.name,
                aq_index: f.properties.measurement?.AQ_hourly_index || null,
                updated_at: f.properties.updated_at
            }
        }));

        return createSuccessResponse({
            type: "FeatureCollection",
            features
        }, CACHE_TTL.AIR_QUALITY);

    } catch (error) {
        console.error("Air Quality API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
