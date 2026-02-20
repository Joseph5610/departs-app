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
        // 1. Fetch static GTFS trip data (schedule and shape)
        // Public GTFS Trips API uses the 'scopes' parameter.
        const staticPromise = golemioFetch(`/v2/public/gtfs/trips/${tripId}`, env, {
            cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
            searchParams: {
                scopes: 'info,stop_times,shapes'
            }
        }).catch(() => null);

        // 2. Fetch real-time position and metadata
        // Public vehiclepositions endpoint by vehicle ID also uses 'scopes'.
        const rtPromise = !isPlaceholder
            ? golemioFetch(`/v2/public/vehiclepositions/${vehicleId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: {
                    scopes: 'info,vehicle_descriptor'
                }
            }).catch(() => null)
            : Promise.resolve(null);

        const [staticRes, rtRes] = await Promise.all([staticPromise, rtPromise]);

        // Resilience: We need at least one source to succeed.
        if ((!staticRes || !staticRes.ok) && (!rtRes || !rtRes.ok)) {
            const status = staticRes?.status || rtRes?.status || 404;
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(status), status);
        }

        const staticData = (staticRes && staticRes.ok) ? await staticRes.json() as GolemioResponse : null;
        const rtData = (rtRes && rtRes.ok) ? await rtRes.json() as GolemioResponse : null;

        /**
         * Normalizes various Golemio response formats (FeatureCollection, Feature, or flat object).
         */
        const normalize = (data: GolemioResponse | null) => {
            if (!data) return {};
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
        const rtNormalized = normalize(rtData);

        // RT is considered valid if we have at least some properties or a Feature
        const isRtValid = !!rtData && (
            (rtData.features && Array.isArray(rtData.features) && rtData.features.length > 0) ||
            rtData.type === 'Feature' ||
            !!(rtNormalized.vehicle_id || rtNormalized.trip_id)
        );

        // Merge logic: Start with static as base, override with RT for real-time fields.
        const vehicleData: Record<string, unknown> = {
            ...staticNormalized,
        };

        if (isRtValid) {
            Object.entries(rtNormalized).forEach(([key, value]) => {
                // Avoid overwriting valid static schedule/shapes with empty RT data
                if (key === 'stop_times' || key === 'shapes') {
                    const hasItems = Array.isArray(value) ? value.length > 0 : (value && typeof value === 'object' && 'features' in value && Array.isArray(value.features) && value.features.length > 0);
                    if (hasItems) {
                        vehicleData[key] = value;
                    }
                } else if (value !== undefined && value !== null) {
                    vehicleData[key] = value;
                }
            });
        }

        // Ensure core properties are present with robust fallbacks
        vehicleData.gtfs_trip_id = rtNormalized.gtfs_trip_id || staticNormalized.gtfs_trip_id || staticNormalized.trip_id || tripId;
        vehicleData.gtfs_trip_headsign = rtNormalized.gtfs_trip_headsign || rtNormalized.trip_headsign || staticNormalized.gtfs_trip_headsign || staticNormalized.trip_headsign;
        vehicleData.gtfs_route_short_name = rtNormalized.gtfs_route_short_name || rtNormalized.route_short_name || staticNormalized.gtfs_route_short_name || staticNormalized.route_short_name;
        vehicleData.gtfs_route_type = rtNormalized.gtfs_route_type || rtNormalized.route_type || staticNormalized.gtfs_route_type || staticNormalized.route_type;

        if (!vehicleData.trip_headsign) vehicleData.trip_headsign = vehicleData.gtfs_trip_headsign;
        if (!vehicleData.route_short_name) vehicleData.route_short_name = vehicleData.gtfs_route_short_name;

        // Fly-to-ocean prevention: Filter out invalid [0,0] coordinates
        if (vehicleData.geometry && typeof vehicleData.geometry === 'object') {
            const geom = vehicleData.geometry as { type?: string; coordinates?: unknown };
            if (Array.isArray(geom.coordinates) &&
               (geom.coordinates.length < 2 || (geom.coordinates[0] === 0 && geom.coordinates[1] === 0))) {
                delete vehicleData.geometry;
            }
        }

        // Normalize stop_times to FeatureCollection format for the frontend
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

        // Normalize shapes to a flat coordinate array
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
