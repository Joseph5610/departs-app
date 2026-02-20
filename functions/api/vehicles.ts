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
    const routeType = url.searchParams.get("routeType");
    const tripId = url.searchParams.get("tripId");
    const routeShortNames = url.searchParams.getAll("routeShortName");

    // Validate: at least one filter must be present
    if (!tripId && !bounds && routeShortNames.length === 0) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    try {
        const fetchPromises: Promise<Response>[] = [];

        // 1. Prepare fetch for bounding box / route filters (Public API)
        if (bounds || routeShortNames.length > 0) {
            const params: Record<string, string | string[]> = {};
            if (bounds) params.boundingBox = bounds;
            if (routeType) params.routeType = routeType;
            if (routeShortNames.length > 0) params.routeShortName = routeShortNames;

            fetchPromises.push(golemioFetch("/v2/public/vehiclepositions", env, { searchParams: params }));
        }

        // 2. Prepare fetch for specific Trip ID (Non-public v2 API lookup by trip ID path)
        if (tripId) {
            fetchPromises.push(golemioFetch(`/v2/vehiclepositions/${tripId}`, env));
        }

        // 3. Execute all fetches in parallel
        const responses = await Promise.all(fetchPromises);
        let allFeatures: GolemioVehicleFeature[] = [];

        for (const res of responses) {
            if (!res.ok) continue;

            try {
                const data = await res.json() as Record<string, unknown> | Array<unknown>;
                if (!data) continue;

                // Normalize differently based on response structure
                if (!Array.isArray(data) && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
                    const features = data.features.map((f: unknown) => normalizeVehicleFeature(f as GolemioVehicleFeature, tripId || undefined));
                    allFeatures = [...allFeatures, ...features];
                } else if (!Array.isArray(data) && data.type === 'Feature') {
                    allFeatures.push(normalizeVehicleFeature(data as unknown as GolemioVehicleFeature, tripId || undefined));
                } else if (Array.isArray(data)) {
                    // Some internal endpoints might return a plain array
                    const features = data.map((f: unknown) => {
                        const item = f as Record<string, unknown>;
                        const feature = (item.type === 'Feature' ? item : { type: 'Feature', geometry: item.geometry, properties: item.properties || item }) as unknown as GolemioVehicleFeature;
                        return normalizeVehicleFeature(feature, tripId || undefined);
                    });
                    allFeatures = [...allFeatures, ...features];
                }
            } catch (e) {
                console.warn("Failed to parse vehicle response:", e);
                continue;
            }
        }

        // 4. Process (deduplicate and jitter) the combined results
        const features = processVehicleFeatures(allFeatures);

        return createSuccessResponse({ type: 'FeatureCollection', features }, CACHE_TTL.VEHICLES);

    } catch (error) {
        console.error("Vehicles API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
