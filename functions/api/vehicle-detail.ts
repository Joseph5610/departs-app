import { Env } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch } from "../_utils/api-utils";

interface FeatureCollection {
    type: string;
    features: Array<{
        type: string;
        geometry?: {
            type: string;
            coordinates: [number, number];
        };
        properties?: Record<string, unknown>;
    }>;
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
                // Request detailed scopes for the UI
                scopes: ['info', 'stop_times', 'shapes', 'vehicle_descriptor']
            }
        });

        if (!response.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data = await response.json() as Record<string, unknown>;

        // Standardize output structure
        const vehicleData = data;

        // If coming from static GTFS trips, the Public API returns a plain object
        // but we ensure it matches the real-time property names for the UI.
        if (isPlaceholder) {
            // Ensure static trip properties match expected real-time property names
            vehicleData.gtfs_trip_id = vehicleData.gtfs_trip_id || vehicleData.trip_id || tripId;
            vehicleData.gtfs_trip_headsign = vehicleData.gtfs_trip_headsign || vehicleData.trip_headsign;
            vehicleData.gtfs_route_short_name = vehicleData.gtfs_route_short_name || vehicleData.route_short_name;
        }

        // Normalize stop_times: The frontend expects { features: [ { properties: { ... } }, ... ] }
        // Golemio's public API returns a FeatureCollection for stop_times.
        // If it's already a FeatureCollection, we just ensure it's there.
        // If it's a plain array (fallback for other API versions), we wrap it.
        const stopTimes = vehicleData.stop_times as Record<string, unknown> | unknown[];
        if (stopTimes && Array.isArray(stopTimes)) {
            vehicleData.stop_times = {
                type: 'FeatureCollection',
                features: stopTimes.map((st) => ({
                    type: 'Feature',
                    properties: st
                }))
            };
        } else if (stopTimes && typeof stopTimes === 'object' && 'features' in stopTimes && Array.isArray((stopTimes as unknown as FeatureCollection).features)) {
            // It's already a FeatureCollection, ensure it's in the correct format
            const fc = stopTimes as unknown as FeatureCollection;
            vehicleData.stop_times = {
                type: 'FeatureCollection',
                features: fc.features.map((f) => ({
                    type: 'Feature',
                    geometry: f.geometry,
                    properties: f.properties || f
                }))
            };
        }

        // Shape optimization: Flatten FeatureCollection of Points into a simple array of coordinates
        // to reduce payload size and simplify frontend processing.
        const shapes = vehicleData.shapes as Record<string, unknown> | unknown[];
        if (shapes && typeof shapes === 'object' && 'features' in shapes && Array.isArray((shapes as unknown as FeatureCollection).features)) {
            const fc = shapes as unknown as FeatureCollection;
            vehicleData.shapes = fc.features
                .filter((f) => f.geometry?.type === 'Point')
                .map((f) => f.geometry?.coordinates);
        } else if (!Array.isArray(vehicleData.shapes)) {
            vehicleData.shapes = [];
        }

        return createSuccessResponse(vehicleData, CACHE_TTL.VEHICLE_DETAIL);
    } catch (error) {
        console.error("Vehicle Detail API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
