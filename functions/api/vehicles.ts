import { Env, GolemioVehicleFeature } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, golemioFetch, createErrorResponse, createSuccessResponse } from "../_utils/api-utils";
import { normalizeVehicleFeature, processVehicleFeatures } from "../_utils/transit-utils";

/**
 * Handles retrieval of vehicle positions.
 * Supports filtering by bounding box, route type, and route short names.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const bounds = searchParams.get("bounds");
    const routeTypes = searchParams.getAll("routeType");
    const routeShortNames = searchParams.getAll("routeShortName");

    // Validate: at least one filter must be present
    if (!bounds && routeShortNames.length === 0 && routeTypes.length === 0) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    try {
        const params: Record<string, string | string[]> = {};
        if (bounds) params.boundingBox = bounds;
        if (routeTypes.length > 0) params.routeType = routeTypes;
        if (routeShortNames.length > 0) params.routeShortName = routeShortNames;

        const response = await golemioFetch("/v2/public/vehiclepositions", env, {
            searchParams: params,
            cacheTtl: CACHE_TTL.VEHICLES
        });

        if (!response.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data = await response.json() as { type: string, features?: GolemioVehicleFeature[] } | GolemioVehicleFeature;

        // Standardize features into an array
        let rawFeatures: GolemioVehicleFeature[] = [];
        if ('type' in data && data.type === 'FeatureCollection' && 'features' in data) {
            rawFeatures = data.features || [];
        } else if ('type' in data && data.type === 'Feature') {
            rawFeatures = [data as GolemioVehicleFeature];
        }

        // Normalize and process (deduplicate and jitter)
        const normalizedFeatures = rawFeatures.map(f => normalizeVehicleFeature(f));
        const features = processVehicleFeatures(normalizedFeatures);

        return createSuccessResponse({ type: 'FeatureCollection', features }, CACHE_TTL.VEHICLES);

    } catch (error) {
        console.error("Vehicles API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
