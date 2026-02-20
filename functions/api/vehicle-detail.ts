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
        // We use the semicolon suffix for the public vehiclepositions endpoint to ensure we get the right trip.
        const rtPromise = !isPlaceholder
            ? golemioFetch(`/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: {
                    // We also include stop_times and shapes in RT as a fallback/enrichment
                    scopes: 'info,vehicle_descriptor,stop_times,shapes'
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
            let normalized: Record<string, unknown> = {};

            if (data.features && Array.isArray(data.features) && data.features.length > 0) {
                normalized = { ...(data.features[0].properties || {}) };
                if (data.shapes || data.features[0].properties?.shapes) normalized.shapes = data.shapes || data.features[0].properties?.shapes;
                if (data.stop_times || data.features[0].properties?.stop_times) normalized.stop_times = data.stop_times || data.features[0].properties?.stop_times;
                if (data.features[0].geometry) normalized.geometry = data.features[0].geometry;
            } else if (data.type === 'Feature') {
                normalized = { ...(data.properties || {}) };
                if (data.shapes || data.properties?.shapes) normalized.shapes = data.shapes || data.properties?.shapes;
                if (data.stop_times || data.properties?.stop_times) normalized.stop_times = data.stop_times || data.properties?.stop_times;
                if (data.geometry) normalized.geometry = data.geometry;
            } else {
                normalized = { ...data };
            }
            return normalized;
        };

        const staticNormalized = normalize(staticData);
        const rtNormalized = rtData ? normalize(rtData) : null;

        // Merge RT data into Static base
        // IMPORTANT: We only merge RT data if it's NOT an empty collection
        const isRtValid = rtData && (!rtData.features || (Array.isArray(rtData.features) && rtData.features.length > 0) || rtData.type === 'Feature');

        const vehicleData: Record<string, unknown> = {
            ...staticNormalized,
            // Add RT properties if available
            ...(isRtValid ? rtNormalized : {}),
            // Ensure core properties are present (fallbacks to static or params)
            gtfs_trip_id: (isRtValid ? rtNormalized?.gtfs_trip_id : null) || staticNormalized.gtfs_trip_id || staticNormalized.trip_id || tripId,
            gtfs_trip_headsign: (isRtValid ? (rtNormalized?.gtfs_trip_headsign || rtNormalized?.trip_headsign) : null) || staticNormalized.gtfs_trip_headsign || staticNormalized.trip_headsign,
            gtfs_route_short_name: (isRtValid ? (rtNormalized?.gtfs_route_short_name || rtNormalized?.route_short_name) : null) || staticNormalized.gtfs_route_short_name || staticNormalized.route_short_name,
            gtfs_route_type: (isRtValid ? (rtNormalized?.gtfs_route_type || rtNormalized?.route_type) : null) || staticNormalized.gtfs_route_type || staticNormalized.route_type,
        };

        // Ensure trip_headsign and route_short_name are also present for components using them
        if (!vehicleData.trip_headsign) vehicleData.trip_headsign = vehicleData.gtfs_trip_headsign;
        if (!vehicleData.route_short_name) vehicleData.route_short_name = vehicleData.gtfs_route_short_name;

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
