import { Env } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch } from "../_utils/api-utils";

interface ShapeFeature {
    geometry: {
        type: string;
        coordinates: [number, number];
    };
}

interface VehicleData {
    features?: Array<{ properties: Record<string, unknown> }>;
    shapes?: {
        features: ShapeFeature[];
    } | Array<[number, number]>;
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
    const scopes = ['info', 'stop_times', 'shapes', 'vehicle_descriptor'];

    try {
        let response: Response;
        let usedStaticFallback = false;

        if (isPlaceholder) {
            response = await golemioFetch(`/v2/public/gtfs/trips/${tripId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: { scopes }
            });
        } else {
            // Try real-time first with standard query parameter
            response = await golemioFetch(`/v2/public/vehiclepositions/${vehicleId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: {
                    gtfsTripId: tripId,
                    scopes
                }
            });

            // If real-time fails (e.g. 404), fall back to static GTFS trip data
            if (!response.ok) {
                console.warn(`Real-time fetch failed (${response.status}), falling back to static GTFS for trip ${tripId}`);
                response = await golemioFetch(`/v2/public/gtfs/trips/${tripId}`, env, {
                    cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                    searchParams: { scopes }
                });
                usedStaticFallback = true;
            }
        }

        if (!response.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data = await response.json() as any;

        // Standardize output structure: handle Feature, FeatureCollection, or flat object
        let vehicleData: Record<string, unknown> = {};

        if (data.type === 'FeatureCollection' && data.features?.length > 0) {
            const feature = data.features[0];
            vehicleData = {
                ...feature.properties,
                geometry: feature.geometry,
                // Keep root-level metadata often provided alongside FeatureCollection when using scopes
                stop_times: data.stop_times || feature.properties?.stop_times,
                shapes: data.shapes || feature.properties?.shapes,
                vehicle_descriptor: data.vehicle_descriptor || feature.properties?.vehicle_descriptor,
            };
        } else if (data.type === 'Feature') {
            vehicleData = {
                ...data.properties,
                geometry: data.geometry,
                stop_times: data.stop_times || data.properties?.stop_times,
                shapes: data.shapes || data.properties?.shapes,
            };
        } else {
            // Flat object (typical for gtfs/trips)
            vehicleData = data;
        }

        if (usedStaticFallback) {
            vehicleData.is_static_fallback = true;
        }

        // Shape optimization: Flatten FeatureCollection of Points into a simple array of coordinates
        if (vehicleData.shapes && !Array.isArray(vehicleData.shapes) && typeof vehicleData.shapes === 'object') {
            const shapesObj = vehicleData.shapes as { features?: ShapeFeature[] };
            if (shapesObj.features) {
                vehicleData.shapes = shapesObj.features
                    .filter((f: ShapeFeature) => f.geometry.type === 'Point')
                    .map((f: ShapeFeature) => f.geometry.coordinates);
            } else {
                vehicleData.shapes = [];
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
