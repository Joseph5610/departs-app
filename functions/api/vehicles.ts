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
    const routeShortNamesRaw = url.searchParams.getAll("routeShortName");

    // Parse run numbers from route short names (e.g., "58/1")
    const routeFilters = routeShortNamesRaw.map(name => {
        const [line, run] = name.split('/');
        return {
            line: line.trim().toUpperCase(),
            run: run ? run.trim() : null
        };
    });

    const routeShortNames = [...new Set(routeFilters.map(f => f.line))];

    // Map human-readable route types to GTFS route types
    const routeTypeMap: Record<string, string> = {
        'metro': '1',
        'tram': '0',
        'bus': '3',
        'trolleybus': '11',
        'train': '2',
        'ferry': '4',
        'funicular': '7'
    };

    const mappedRouteTypes = routeTypes.map(t => routeTypeMap[t] || t);

    // Validate: at least one filter must be present
    if (!tripId && !bounds && routeShortNames.length === 0 && mappedRouteTypes.length === 0) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    try {
        const fetchPromises: Promise<Response>[] = [];

        // 1. Prepare fetch for bounding box / route filters (Public API)
        if (bounds || routeShortNames.length > 0 || mappedRouteTypes.length > 0) {
            const params: Record<string, string | string[]> = {};
            if (bounds) params.boundingBox = bounds;
            if (mappedRouteTypes.length > 0) params.routeType = mappedRouteTypes;

            // If we have run numbers, we fetch the whole line and filter later
            // If we only have plain lines, we let Golemio filter them
            if (routeShortNames.length > 0) {
                params.routeShortName = routeShortNames;
            }

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
                let features = (data.features || []).map((f) => normalizeVehicleFeature(f, tripId || undefined));

                // Post-fetch filtering for run numbers if needed
                if (routeFilters.some(f => f.run)) {
                    features = features.filter(f => {
                        const line = (f.properties.route_short_name || '').toUpperCase();
                        const run = String(f.properties.run_number ?? '');

                        // Check if this vehicle matches any of our specific line/run combinations
                        // or if it matches a plain line filter
                        return routeFilters.some(rf => {
                            if (rf.run) {
                                return rf.line === line && rf.run === run;
                            }
                            return rf.line === line;
                        });
                    });
                }

                allFeatures = [...allFeatures, ...features];
            } else if ('type' in data && data.type === 'Feature') {
                allFeatures.push(normalizeVehicleFeature(data as GolemioVehicleFeature, tripId || undefined));
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
