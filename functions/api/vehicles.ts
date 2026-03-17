import { Env, GolemioVehicleFeature } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, golemioFetch, createErrorResponse, createSuccessResponse } from "../_utils/api-utils";
import { normalizeVehicleFeature, processVehicleFeatures } from "../_utils/transit-utils";

/**
 * Handles retrieval of vehicle positions.
 * Supports filtering by bounding box, route type, trip ID, and route short names.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);

    // Extract query parameters
    const bounds = url.searchParams.get("bounds");
    const routeTypes = url.searchParams.getAll("routeType");
    const routeShortNames = url.searchParams.getAll("routeShortName");

    // Validate: at least one filter must be present
    if (!bounds && routeShortNames.length === 0 && routeTypes.length === 0) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    try {
        const fetchPromises: Promise<Response>[] = [];

        // 1. Prepare fetch for bounding box / route filters (Public API)
        if (bounds || routeShortNames.length > 0 || routeTypes.length > 0) {
            const params: Record<string, string | string[]> = {};
            if (bounds) params.boundingBox = bounds;
            if (routeTypes.length > 0) params.routeType = routeTypes;

            if (routeShortNames.length > 0) {
                params.routeShortName = routeShortNames;
            }

            fetchPromises.push(golemioFetch("/v2/public/vehiclepositions", env, { searchParams: params }));
        }

        // 2. Execute all fetches in parallel
        const responses = await Promise.all(fetchPromises);
        let allFeatures: GolemioVehicleFeature[] = [];

        for (const res of responses) {
            if (!res.ok) continue; // Skip failed fetches gracefully if we have multiple

            const data = await res.json() as { type: string, features?: GolemioVehicleFeature[] } | GolemioVehicleFeature;

            // Normalize differently based on response structure
            if ('type' in data && data.type === 'FeatureCollection' && 'features' in data) {
                const features = (data.features || []).map((f) => normalizeVehicleFeature(f));
                allFeatures = [...allFeatures, ...features];
            } else if ('type' in data && data.type === 'Feature') {
                allFeatures.push(normalizeVehicleFeature(data as GolemioVehicleFeature));
            }
        }

        // 3. Process (deduplicate and jitter) the combined results
        const features = processVehicleFeatures(allFeatures);

        return createSuccessResponse({ type: 'FeatureCollection', features }, CACHE_TTL.VEHICLES);

    } catch (error) {
        console.error("Vehicles API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
