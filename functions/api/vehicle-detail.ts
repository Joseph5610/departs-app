import { Env } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch } from "../_utils/api-utils";

interface GolemioResponse {
    type?: string;
    features?: Array<{
        properties?: Record<string, unknown>;
        geometry?: unknown;
    }>;
    properties?: Record<string, unknown>;
    geometry?: unknown;
    shapes?: unknown;
    stop_times?: unknown;
    [key: string]: unknown;
}

/**
 * Retrieves detailed information about a specific vehicle and its current trip.
 * Includes real-time position, scheduled stop times, and the trip's shape.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;
    const { searchParams } = new URL(context.request.url);
    const vehicleId = searchParams.get("vehicleId");
    const tripId = searchParams.get("tripId");

    if (!tripId) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    const isPlaceholder = vehicleId?.startsWith('trip-') || !vehicleId;

    try {
        // We try multiple combinations to be extremely resilient to Golemio API changes/versions.

        // 1. Fetch static GTFS trip data. We try both non-public and public versions.
        const staticPaths = [`/v2/gtfs/trips/${tripId}`, `/v2/public/gtfs/trips/${tripId}`];
        let staticData: GolemioResponse | null = null;

        for (const path of staticPaths) {
            const isPublic = path.includes('/public/');
            const res = await golemioFetch(path, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: isPublic
                    ? { scopes: 'info,stop_times,shapes' }
                    : { includeStopTimes: 'true', includeShapes: 'true' }
            }).catch(() => null);

            if (res && res.ok) {
                staticData = await res.json() as GolemioResponse;
                break;
            }
        }

        // 2. Fetch real-time position.
        let rtData: GolemioResponse | null = null;
        if (!isPlaceholder) {
            // Priority 1: Non-public by tripId (most accurate for the active run)
            // Priority 2: Public by vehicleId
            const rtPaths = [
                { path: `/v2/vehiclepositions/${tripId}`, params: {} },
                { path: `/v2/public/vehiclepositions/${vehicleId}`, params: { scopes: 'info,vehicle_descriptor' } }
            ];

            for (const { path, params } of rtPaths) {
                const res = await golemioFetch(path, env, {
                    cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                    searchParams: params
                }).catch(() => null);

                if (res && res.ok) {
                    rtData = await res.json() as GolemioResponse;
                    // If it's a collection, make sure it has data
                    if (rtData.type === 'FeatureCollection' && (!rtData.features || rtData.features.length === 0)) {
                        rtData = null;
                        continue;
                    }
                    break;
                }
            }
        }

        // 3. Normalize and Merge
        const normalize = (data: GolemioResponse | null) => {
            if (!data) return {};
            let normalized: Record<string, unknown> = {};

            if (data.type === 'FeatureCollection' && data.features && data.features.length > 0) {
                const firstFeature = data.features[0];
                normalized = { ...(firstFeature.properties || {}) };
                if (firstFeature.geometry) normalized.geometry = firstFeature.geometry;

                // Use type casting to access potential nested properties safely
                const props = (firstFeature.properties || {}) as Record<string, unknown>;
                if (!normalized.shapes && props.shapes) normalized.shapes = props.shapes;
                if (!normalized.stop_times && props.stop_times) normalized.stop_times = props.stop_times;
            } else if (data.type === 'Feature') {
                normalized = { ...(data.properties || {}) };
                if (data.geometry) normalized.geometry = data.geometry;
            } else {
                normalized = { ...data };
            }

            // Ensure nested shapes/stop_times from root are preserved if not in properties
            if (data.shapes && !normalized.shapes) normalized.shapes = data.shapes;
            if (data.stop_times && !normalized.stop_times) normalized.stop_times = data.stop_times;

            return normalized;
        };

        const staticNormalized = normalize(staticData);
        const rtNormalized = normalize(rtData);

        const vehicleData: Record<string, unknown> = {
            ...staticNormalized,
            // Override with RT data
            ...rtNormalized,
        };

        // Resiliency: Always ensure we have the core IDs even if fetches failed
        vehicleData.gtfs_trip_id = (rtNormalized.gtfs_trip_id as string) || (staticNormalized.gtfs_trip_id as string) || (staticNormalized.trip_id as string) || tripId;
        vehicleData.vehicle_id = vehicleId || (rtNormalized.vehicle_id as string) || (rtNormalized.id as string) || (staticNormalized.vehicle_id as string);

        // Ensure headsign and route name are present
        vehicleData.gtfs_trip_headsign = (rtNormalized.gtfs_trip_headsign as string) || (rtNormalized.trip_headsign as string) || (staticNormalized.gtfs_trip_headsign as string) || (staticNormalized.trip_headsign as string) || (staticNormalized.headsign as string);
        vehicleData.gtfs_route_short_name = (rtNormalized.gtfs_route_short_name as string) || (rtNormalized.route_short_name as string) || (staticNormalized.gtfs_route_short_name as string) || (staticNormalized.route_short_name as string) || (staticNormalized.route_id as string);

        vehicleData.trip_headsign = vehicleData.gtfs_trip_headsign;
        vehicleData.route_short_name = vehicleData.gtfs_route_short_name;

        // Restore static schedule/shapes if RT data "overwrote" them with empty values
        if (staticNormalized.stop_times && (!vehicleData.stop_times || (Array.isArray(vehicleData.stop_times) && vehicleData.stop_times.length === 0))) {
            vehicleData.stop_times = staticNormalized.stop_times;
        }
        if (staticNormalized.shapes && (!vehicleData.shapes || (Array.isArray(vehicleData.shapes) && vehicleData.shapes.length === 0))) {
            vehicleData.shapes = staticNormalized.shapes;
        }

        // 4. Fly-to-ocean prevention: Filter out invalid [0,0] coordinates
        if (vehicleData.geometry && typeof vehicleData.geometry === 'object') {
            const geom = vehicleData.geometry as { type?: string; coordinates?: unknown };
            if (Array.isArray(geom.coordinates) &&
               (geom.coordinates.length < 2 || (geom.coordinates[0] === 0 && geom.coordinates[1] === 0))) {
                delete vehicleData.geometry;
            }
        }

        // 5. Format for Frontend

        // Format stop_times as FeatureCollection
        const rawStopTimes = vehicleData.stop_times;
        if (rawStopTimes) {
            let features: unknown[] = [];
            if (Array.isArray(rawStopTimes)) {
                features = rawStopTimes.map(st => {
                    const item = st as Record<string, unknown>;
                    return { type: 'Feature', properties: item.properties || item };
                });
            } else if (typeof rawStopTimes === 'object' && (rawStopTimes as Record<string, unknown>).features) {
                features = (rawStopTimes as Record<string, unknown>).features as unknown[];
            }
            vehicleData.stop_times = { type: 'FeatureCollection', features };
        }

        // Format shapes as flat coordinate array
        const rawShapes = vehicleData.shapes;
        if (rawShapes) {
            if (Array.isArray(rawShapes)) {
                if (rawShapes.length > 0 && Array.isArray(rawShapes[0])) {
                    // Already coordinates array
                    vehicleData.shapes = rawShapes;
                } else {
                    // Probably array of features
                    vehicleData.shapes = (rawShapes as unknown[])
                        .map(s => {
                            const item = s as Record<string, unknown>;
                            const geom = item.geometry as Record<string, unknown> | undefined;
                            return geom?.coordinates || item.coordinates;
                        })
                        .filter(Boolean);
                }
            } else if (typeof rawShapes === 'object') {
                const sObj = rawShapes as Record<string, unknown>;
                if (sObj.type === 'FeatureCollection' && sObj.features) {
                    const features = sObj.features as Array<Record<string, unknown>>;
                    vehicleData.shapes = features.map(f => {
                        const geom = f.geometry as Record<string, unknown> | undefined;
                        return geom?.coordinates;
                    }).filter(Boolean);
                } else if (sObj.type === 'LineString' && sObj.coordinates) {
                    vehicleData.shapes = sObj.coordinates;
                }
            }
        }

        // Ensure vehicle_descriptor for the UI
        if (!vehicleData.vehicle_descriptor) {
            vehicleData.vehicle_descriptor = {
                is_wheelchair_accessible: vehicleData.is_wheelchair_accessible,
                is_air_conditioned: vehicleData.is_air_conditioned,
                vehicle_registration_number: vehicleData.vehicle_registration_number,
            };
        }

        return createSuccessResponse(vehicleData, CACHE_TTL.VEHICLE_DETAIL);
    } catch (error) {
        console.error("Vehicle Detail API Error:", error);
        // Last resort: return at least the ID so the UI doesn't crash
        return createSuccessResponse({
            gtfs_trip_id: tripId,
            vehicle_id: vehicleId,
            state_position: 'unknown',
            delay: 0
        }, CACHE_TTL.VEHICLE_DETAIL);
    }
};
