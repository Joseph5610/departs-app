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

    // Determine API path:
    // - If it's a placeholder (no real-time vehicle ID yet), fetch from static GTFS trips
    // - Otherwise, fetch from real-time vehicle positions
    const isPlaceholder = vehicleId.startsWith('trip-');
    const path = isPlaceholder
        ? `/v2/public/gtfs/trips/${tripId}`
        : `/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}`;

    try {
        const response = await golemioFetch(path, env, {
            cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
            searchParams: {
                // Request detailed scopes for the UI.
                // NOTE: Use comma-separated string for compatibility across all Golemio endpoints.
                scopes: 'info,stop_times,shapes,vehicle_descriptor'
            }
        });

        if (!response.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data = await response.json() as GolemioResponse;

        // Standardize output structure.
        // Golemio Public GTFS API sometimes returns a FeatureCollection or a single Feature instead of a flat object.
        const vehicleData: Record<string, unknown> = (data.features && Array.isArray(data.features) && data.features.length > 0)
            ? {
                ...(data.features[0].properties || {}),
                shapes: data.shapes || data.features[0].properties?.shapes,
                stop_times: data.stop_times || data.features[0].properties?.stop_times,
                geometry: data.features[0].geometry
            }
            : (data.type === 'Feature'
                ? {
                    ...(data.properties || {}),
                    shapes: data.shapes || data.properties?.shapes,
                    stop_times: data.stop_times || data.properties?.stop_times,
                    geometry: data.geometry
                }
                : { ...data }
            );

        // If coming from static GTFS trips, the Public API returns a plain object
        // but we ensure it matches the real-time property names for the UI.
        if (isPlaceholder) {
            // Ensure static trip properties match expected real-time property names
            vehicleData.gtfs_trip_id = vehicleData.gtfs_trip_id || vehicleData.trip_id || tripId;
            vehicleData.gtfs_trip_headsign = vehicleData.gtfs_trip_headsign || vehicleData.trip_headsign;
            vehicleData.gtfs_route_short_name = vehicleData.gtfs_route_short_name || vehicleData.route_short_name;
            vehicleData.gtfs_route_type = vehicleData.gtfs_route_type || vehicleData.route_type;
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
