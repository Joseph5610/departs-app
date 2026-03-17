import { Env, GolemioVehicleFeature } from "../_utils/types";
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

        if (isPlaceholder) {
            response = await golemioFetch(`/v2/public/gtfs/trips/${tripId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: { scopes }
            });
        } else {
            // Try real-time first with matrix parameter (essential for some Golemio endpoints to link trip data)
            response = await golemioFetch(`/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: { scopes }
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

        const data = (await response.json()) as Record<string, unknown>;

        // Standardize output structure: handle FeatureCollection, Feature, or flat object
        let normalizedFeature: GolemioVehicleFeature;

        const features = data.features as GolemioVehicleFeature[] | undefined;
        if (data.type === 'FeatureCollection' && features && features.length > 0) {
            normalizedFeature = normalizeVehicleFeature(features[0], tripId);
        } else if (data.type === 'Feature') {
            normalizedFeature = normalizeVehicleFeature(data as unknown as GolemioVehicleFeature, tripId);
        } else {
            // Flat object (typical for gtfs/trips)
            const mockFeature = { type: 'Feature', geometry: data.geometry || null, properties: data } as unknown as GolemioVehicleFeature;
            normalizedFeature = normalizeVehicleFeature(mockFeature, tripId);
        }

        // Final vehicle data: core properties from normalization, plus expanded scope data
        const vehicleData: Record<string, unknown> = {
            ...normalizedFeature.properties,
            geometry: normalizedFeature.geometry,
            // Merge root-level metadata often provided alongside FeatureCollection when using scopes
            stop_times: data.stop_times || normalizedFeature.properties?.stop_times,
            shapes: data.shapes || normalizedFeature.properties?.shapes,
        };

        // If upstream provided expanded descriptors/metadata at root, use them
        if (data.vehicle_descriptor) vehicleData.vehicle_descriptor = data.vehicle_descriptor;
        if (data.run_number !== undefined) vehicleData.run_number = data.run_number;
        if (data.origin_timestamp) vehicleData.origin_timestamp = data.origin_timestamp;
        if (data.last_stop_sequence !== undefined) vehicleData.last_stop_sequence = data.last_stop_sequence;
        if (data.next_stop_name) vehicleData.next_stop_name = data.next_stop_name;

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
