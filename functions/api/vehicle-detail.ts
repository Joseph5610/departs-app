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

    if (!vehicleId || !tripId) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    const isPlaceholder = vehicleId.startsWith('trip-');

    try {
        // 1. Always fetch static GTFS trip data (schedule and shape)
        // This is the source of truth for the "Route schedule" tab.
        const staticPromise = golemioFetch(`/v2/public/gtfs/trips/${tripId}`, env, {
            cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
            searchParams: {
                scopes: 'info,stop_times,shapes'
            }
        });

        // 2. If it's a real vehicle, fetch real-time position and delay
        const rtPromise = !isPlaceholder
            ? golemioFetch(`/v2/public/vehiclepositions/${vehicleId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: {
                    scopes: 'info,vehicle_descriptor'
                }
            })
            : Promise.resolve(null);

        const [staticRes, rtRes] = await Promise.all([staticPromise, rtPromise]);

        if (!staticRes.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(staticRes.status), staticRes.status);
        }

        const staticData = await staticRes.json() as GolemioResponse;
        let rtData: GolemioResponse | null = null;

        if (rtRes && rtRes.ok) {
            rtData = await rtRes.json() as GolemioResponse;
        }

        // Standardize output structure.
        // Golemio Public GTFS API sometimes returns a FeatureCollection or a single Feature instead of a flat object.
        const normalize = (data: GolemioResponse) => {
            if (data.features && Array.isArray(data.features) && data.features.length > 0) {
                return {
                    ...(data.features[0].properties || {}),
                    shapes: data.shapes || data.features[0].properties?.shapes,
                    stop_times: data.stop_times || data.features[0].properties?.stop_times,
                    geometry: data.features[0].geometry
                };
            } else if (data.type === 'Feature') {
                return {
                    ...(data.properties || {}),
                    shapes: data.shapes || data.properties?.shapes,
                    stop_times: data.stop_times || data.properties?.stop_times,
                    geometry: data.geometry
                };
            }
            return { ...data };
        };

        const staticNormalized = normalize(staticData);
        const rtNormalized = rtData ? normalize(rtData) : null;

        // Merge RT data into Static base
        const vehicleData: Record<string, unknown> = {
            ...staticNormalized,
            // Ensure static trip properties match expected real-time property names for the UI
            gtfs_trip_id: staticNormalized.gtfs_trip_id || staticNormalized.trip_id || tripId,
            gtfs_trip_headsign: staticNormalized.gtfs_trip_headsign || staticNormalized.trip_headsign,
            gtfs_route_short_name: staticNormalized.gtfs_route_short_name || staticNormalized.route_short_name,
            gtfs_route_type: staticNormalized.gtfs_route_type || staticNormalized.route_type,
            // Add RT properties if available
            ...(rtNormalized || {})
        };

        // If RT data exists but is for a DIFFERENT trip (vehicle still on previous run),
        // we might want to keep the geometry/delay but mark the state.
        if (rtNormalized && rtNormalized.gtfs_trip_id && rtNormalized.gtfs_trip_id !== tripId) {
            // Add a flag that it's the previous trip's position
            vehicleData.state_position = 'before_track';
        }

        // Coordinate Validation: Prevent "fly to ocean" by removing [0, 0] or invalid coordinates
        if (vehicleData.geometry && typeof vehicleData.geometry === 'object') {
            const geom = vehicleData.geometry as { type?: string; coordinates?: unknown };
            if (Array.isArray(geom.coordinates) &&
               (geom.coordinates.length < 2 || (geom.coordinates[0] === 0 && geom.coordinates[1] === 0))) {
                delete vehicleData.geometry;
            }
        }

        // Normalize stop_times: The frontend expects { features: [ { properties: { ... } }, ... ] }
        // Golemio's public API returns a FeatureCollection for stop_times.
        // If it's already a FeatureCollection, we just ensure it's there.
        // If it's a plain array (fallback for other API versions), we wrap it.
        const stopTimes = vehicleData.stop_times;
        if (stopTimes && Array.isArray(stopTimes)) {
            const stopTimesArray = stopTimes as Array<Record<string, unknown>>;
            vehicleData.stop_times = {
                type: 'FeatureCollection',
                features: stopTimesArray.map((st) => ({
                    type: 'Feature',
                    properties: st.properties || st
                }))
            };
        } else if (stopTimes && typeof stopTimes === 'object' && 'features' in (stopTimes as Record<string, unknown>) && Array.isArray((stopTimes as Record<string, unknown>).features)) {
            // It's already a FeatureCollection, ensure it's in the correct format
            const stopTimesObj = stopTimes as Record<string, unknown>;
            const features = stopTimesObj.features as Array<Record<string, unknown>>;
            vehicleData.stop_times = {
                type: 'FeatureCollection',
                features: features.map((f) => ({
                    type: 'Feature',
                    geometry: f.geometry,
                    properties: f.properties || f
                }))
            };
        }

        // Shape optimization: Flatten FeatureCollection of Points into a simple array of coordinates
        // to reduce payload size and simplify frontend processing.
        const shapes = vehicleData.shapes;
        if (shapes && typeof shapes === 'object' && 'features' in (shapes as Record<string, unknown>) && Array.isArray((shapes as Record<string, unknown>).features)) {
            const shapesObj = shapes as Record<string, unknown>;
            const features = shapesObj.features as Array<Record<string, unknown>>;
            vehicleData.shapes = features
                .filter((f) => {
                    const geom = f.geometry as Record<string, unknown> | undefined;
                    return geom?.type === 'Point' || geom?.type === 'point';
                })
                .map((f) => (f.geometry as Record<string, unknown>)?.coordinates);
        } else if (shapes && (shapes as Record<string, unknown>).type === 'LineString' && Array.isArray((shapes as Record<string, unknown>).coordinates)) {
            // If it's a LineString, it's already an array of coordinates
            vehicleData.shapes = (shapes as Record<string, unknown>).coordinates;
        } else if (!Array.isArray(vehicleData.shapes)) {
            vehicleData.shapes = [];
        }

        return createSuccessResponse(vehicleData, CACHE_TTL.VEHICLE_DETAIL);
    } catch (error) {
        console.error("Vehicle Detail API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
