import { Env } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch } from "../_utils/api-utils";
import { normalizeVehicleFeature } from "../_utils/transit-utils";

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

    const isPlaceholder = vehicleId.startsWith('trip-');
    const scopes = ['info', 'stop_times', 'shapes', 'vehicle_descriptor'];

    try {
        let response: Response;
        let usedStaticFallback = false;

        // CRITICAL IMPROVEMENT: If we have a placeholder ID, try to find the real-time vehicle first via tripId.
        // This ensures we get real-time stop data even if the frontend didn't know the vehicle ID yet.
        if (isPlaceholder) {
            response = await golemioFetch(`/v2/public/vehiclepositions`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: { tripId, scopes }
            });

            // If tripId search fails or is empty, fall back to static GTFS
            const checkData = response.ok ? await response.clone().json() as any : null;
            if (!response.ok || (checkData?.type === 'FeatureCollection' && checkData.features?.length === 0)) {
                response = await golemioFetch(`/v2/public/gtfs/trips/${tripId}`, env, {
                    cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                    searchParams: { scopes }
                });
                usedStaticFallback = true;
            }
        } else {
            // Try specific real-time vehicle ID first with matrix parameter
            response = await golemioFetch(`/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: { scopes }
            });

            // Fallback to static GTFS trip data if real-time ID fetch fails
            if (!response.ok) {
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

        // Standardize output structure
        let vehicleData: Record<string, unknown> = {};
        const sourceFeature = (data.type === 'FeatureCollection' && data.features?.length > 0) ? data.features[0] :
                            (data.type === 'Feature' ? data : { type: 'Feature', geometry: data.geometry || null, properties: data });

        const normalized = normalizeVehicleFeature(sourceFeature, tripId);
        vehicleData = {
            ...normalized.properties,
            geometry: normalized.geometry,
            stop_times: data.stop_times || sourceFeature.stop_times || normalized.properties?.stop_times,
            shapes: data.shapes || sourceFeature.shapes || normalized.properties?.shapes,
            vehicle_descriptor: data.vehicle_descriptor || sourceFeature.vehicle_descriptor || normalized.properties?.vehicle_descriptor,
            run_number: data.run_number ?? sourceFeature.run_number ?? normalized.properties?.run_number,
            origin_timestamp: data.origin_timestamp || sourceFeature.origin_timestamp || normalized.properties?.origin_timestamp,
            last_stop_sequence: data.last_stop_sequence ?? sourceFeature.last_stop_sequence ?? normalized.properties?.last_stop_sequence,
            next_stop_name: data.next_stop_name || sourceFeature.next_stop_name || normalized.properties?.next_stop_name,
        };

        if (usedStaticFallback) {
            vehicleData.is_static_fallback = true;
        }

        // Shape optimization
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
