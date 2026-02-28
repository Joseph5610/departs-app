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
    const tripId = url.searchParams.get("tripId");
    const routeShortNames = url.searchParams.getAll("routeShortName");

    // Process routeShortNames to separate line and run number filters (e.g., "58/1")
    const lineFilters = new Set<string>();
    const runFilters = new Map<string, Set<string>>(); // line -> Set of run numbers

    routeShortNames.forEach(filter => {
        const parts = filter.split('/');
        const line = parts[0].trim().toUpperCase();
        if (line) {
            lineFilters.add(line);
            if (parts.length > 1) {
                const run = parts[1].trim();
                if (run) {
                    if (!runFilters.has(line)) {
                        runFilters.set(line, new Set());
                    }
                    runFilters.get(line)!.add(run);
                }
            }
        }
    });

    // Validate: at least one filter must be present
    if (!tripId && !bounds && lineFilters.size === 0 && routeTypes.length === 0) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    try {
        const fetchPromises: Promise<Response>[] = [];

        // 1. Prepare fetch for bounding box / route filters (Public API)
        if (bounds || lineFilters.size > 0 || routeTypes.length > 0) {
            const params: Record<string, string | string[]> = {};
            if (bounds) params.boundingBox = bounds;
            if (routeTypes.length > 0) params.routeType = routeTypes;
            if (lineFilters.size > 0) params.routeShortName = Array.from(lineFilters);

            fetchPromises.push(golemioFetch("/v2/public/vehiclepositions", env, { searchParams: params }));
        }

        // 2. Prepare fetch for specific Trip ID (Internal API for higher precision/specific trip tracking)
        if (tripId) {
            fetchPromises.push(golemioFetch(`/v2/vehiclepositions/${tripId}`, env));
        }

        // 3. Execute all fetches in parallel
        const responses = await Promise.all(fetchPromises);
        let allFeatures: GolemioVehicleFeature[] = [];

        for (const res of responses) {
            if (!res.ok) continue; // Skip failed fetches gracefully if we have multiple

            const data = await res.json() as { type: string, features?: GolemioVehicleFeature[] } | GolemioVehicleFeature;

            // Normalize differently based on response structure
            if ('type' in data && data.type === 'FeatureCollection' && 'features' in data) {
                const features = (data.features || []).map((f) => normalizeVehicleFeature(f, tripId || undefined));
                allFeatures = [...allFeatures, ...features];
            } else if ('type' in data && data.type === 'Feature') {
                allFeatures.push(normalizeVehicleFeature(data as GolemioVehicleFeature, tripId || undefined));
            }
        }

        // 4. Apply run number filtering if requested
        if (runFilters.size > 0) {
            allFeatures = allFeatures.filter(f => {
                const line = String(f.properties.route_short_name || f.properties.gtfs_route_short_name || '').trim().toUpperCase();
                const run = String(f.properties.run_number ?? '').trim();

                if (line && runFilters.has(line)) {
                    const allowedRuns = runFilters.get(line);
                    // Check if there's also a "naked" line filter without a run number (e.g. "58, 58/1")
                    const isExplicitlyFilteredByLineOnly = routeShortNames.some(f => {
                        const parts = f.split('/');
                        return parts[0].trim().toUpperCase() === line && parts.length === 1;
                    });

                    if (isExplicitlyFilteredByLineOnly) return true;

                    // Match run number: handle potential leading zeros
                    // e.g. "1" matches "01" or "001"
                    return Array.from(allowedRuns || []).some(r => {
                        const rClean = r.trim().replace(/^0+/, '');
                        const runClean = run.replace(/^0+/, '');
                        return rClean === runClean && rClean !== '';
                    });
                }
                return true;
            });
        }

        // 5. Process (deduplicate and jitter) the combined results
        const features = processVehicleFeatures(allFeatures);

        return createSuccessResponse({ type: 'FeatureCollection', features }, CACHE_TTL.VEHICLES);

    } catch (error) {
        console.error("Vehicles API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
