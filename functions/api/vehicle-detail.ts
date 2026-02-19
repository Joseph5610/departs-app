import { Env } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch } from "../_utils/api-utils";

interface ShapeFeature {
    geometry: {
        type: string;
        coordinates: [number, number];
    };
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
        let vehicleData: Record<string, unknown> = data;

        // If coming from static GTFS trips, handle flattening from Feature/FeatureCollection
        if (isPlaceholder) {
            const features = data.features as Array<{ properties?: Record<string, unknown> }> | undefined;
            if (features && Array.isArray(features) && features.length > 0) {
                vehicleData = features[0].properties || (features[0] as unknown as Record<string, unknown>);
                if (data.shapes) vehicleData.shapes = data.shapes;
            } else if (data.type === 'Feature' && data.properties) {
                vehicleData = data.properties as Record<string, unknown>;
                if (data.shapes) vehicleData.shapes = data.shapes;
            }

            // Ensure static trip properties match expected real-time property names
            if (vehicleData.trip_headsign && !vehicleData.gtfs_trip_headsign) {
                vehicleData.gtfs_trip_headsign = vehicleData.trip_headsign;
            }
            if (vehicleData.route_short_name && !vehicleData.gtfs_route_short_name) {
                vehicleData.gtfs_route_short_name = vehicleData.route_short_name;
            }
        }

        // Normalize stop_times: The frontend expects { features: [ { properties: { ... } }, ... ] }
        // Golemio's public API might return a plain array for stop_times, especially for static trips.
        const stopTimes = vehicleData.stop_times;
        if (stopTimes && Array.isArray(stopTimes)) {
            vehicleData.stop_times = {
                features: stopTimes.map((st: unknown) => ({
                    properties: st
                }))
            };
        }

        // Shape optimization: Flatten FeatureCollection of Points into a simple array of coordinates
        // to reduce payload size and simplify frontend processing.
        if (vehicleData.shapes && !Array.isArray(vehicleData.shapes) && typeof vehicleData.shapes === 'object') {
            const shapesObj = vehicleData.shapes as { features?: ShapeFeature[] };
            if (shapesObj.features) {
                vehicleData.shapes = shapesObj.features
                    .filter((f: ShapeFeature) => f.geometry.type === 'Point')
                    .map((f: ShapeFeature) => f.geometry.coordinates);
            }
        } else if (!vehicleData.shapes) {
            vehicleData.shapes = [];
        }

        return createSuccessResponse(vehicleData, CACHE_TTL.VEHICLE_DETAIL);
    } catch (error) {
        console.error("Vehicle Detail API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
