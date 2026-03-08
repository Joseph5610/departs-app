import { Env, GolemioParkingFeature, GolemioParkingOccupancy } from "../_utils/types";
import { CACHE_TTL, golemioFetch, createErrorResponse, createSuccessResponse, ERROR_MESSAGES } from "../_utils/api-utils";

/**
 * Endpoint for retrieving parking locations and their real-time occupancy.
 * Combines v3 parking data with real-time occupancy measurements.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    try {
        // 1. Fetch parking locations (v3)
        // We limit to 1000 items as a reasonable default for the entire city
        const locationsRes = await golemioFetch("/v3/parking", env, {
            cacheTtl: CACHE_TTL.PARKING,
            searchParams: { limit: "1000", activeOnly: "true" }
        });

        if (!locationsRes.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(locationsRes.status), locationsRes.status);
        }

        const locationsData = await locationsRes.json() as { features: GolemioParkingFeature[] };

        // 2. Fetch occupancy measurements (v3)
        const occupancyRes = await golemioFetch("/v3/parking-measurements", env, {
            cacheTtl: CACHE_TTL.PARKING,
            searchParams: { limit: "10000" } // Get as many as possible to match
        });

        const occupancyData = occupancyRes.ok
            ? await occupancyRes.json() as GolemioParkingOccupancy[]
            : [];

        // 3. Create a map of occupancy for quick lookup
        const occupancyMap = new Map<string, GolemioParkingOccupancy>();
        occupancyData.forEach(occ => occupancyMap.set(occ.parking_id, occ));

        // 4. Merge occupancy into location features
        const features = locationsData.features.map(feature => {
            const occupancy = occupancyMap.get(feature.properties.id);
            return {
                ...feature,
                properties: {
                    id: feature.properties.id,
                    name: feature.properties.name,
                    parking_policy: feature.properties.parking_policy,
                    parking_type: feature.properties.parking_type,
                    has_occupancy_info: feature.properties.has_occupancy_info,
                    free_spots: occupancy?.free_spot_number ?? null,
                    total_spots: occupancy?.total_spot_number ?? null,
                    last_updated: occupancy?.last_updated ?? feature.properties.last_updated_at
                }
            };
        });

        return createSuccessResponse({
            type: "FeatureCollection",
            features
        }, CACHE_TTL.PARKING);

    } catch (error) {
        console.error("Parking API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
