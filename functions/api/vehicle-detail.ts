import { Env, GolemioVehicleFeature } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch, sanitizeId } from "../_utils/api-utils";
import { normalizeVehicleFeature } from "../_utils/transit-utils";
import { getVehicleColor } from "../_utils/vehicle-colors";
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
    const vehicleId = sanitizeId(searchParams.get("vehicleId"));
    const tripId = sanitizeId(searchParams.get("tripId"));

    if (!tripId) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    const scopes = ['info', 'stop_times', 'shapes', 'vehicle_descriptor'];

    const fetchStaticTrip = async () => {
        const res = await golemioFetch(`/v2/public/gtfs/trips/${tripId}`, env, {
            cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
            searchParams: { scopes }
        });
        return { response: res, isStatic: true };
    };

    try {
        let response: Response;
        let isStatic = false;

        if (!vehicleId) {
            // No vehicle ID provided - direct static fallback
            ({ response, isStatic } = await fetchStaticTrip());
        } else {
            // Try real-time first with matrix parameter (essential for some Golemio endpoints to link trip data)
            response = await golemioFetch(`/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: { scopes }
            });

            // If real-time fails (e.g. 404), fall back to static GTFS trip data
            if (!response.ok) {
                console.warn(`Real-time fetch failed (${response.status}), falling back to static GTFS for trip ${tripId}`);
                ({ response, isStatic } = await fetchStaticTrip());
            }
        }

        if (!response.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data = (await response.json()) as any;

        // Standardize output structure: handle FeatureCollection, Feature, or flat object
        let normalizedFeature: GolemioVehicleFeature;

        if (data.type === 'FeatureCollection' && Array.isArray(data.features) && data.features.length > 0) {
            normalizedFeature = normalizeVehicleFeature(data.features[0], tripId);
        } else if (data.type === 'Feature') {
            normalizedFeature = normalizeVehicleFeature(data as GolemioVehicleFeature, tripId);
        } else {
            // Flat object (typical for gtfs/trips)
            const mockFeature: GolemioVehicleFeature = {
                type: 'Feature',
                geometry: data.geometry || null,
                properties: data as GolemioVehicleFeature['properties']
            };
            normalizedFeature = normalizeVehicleFeature(mockFeature, tripId);
        }

        // Final vehicle data: core properties from normalization, plus expanded scope data
        const vehicleData: Record<string, any> = {
            ...normalizedFeature.properties,
            geometry: normalizedFeature.geometry,
            // Merge root-level metadata often provided alongside FeatureCollection when using scopes
            stop_times: data.stop_times || (normalizedFeature.properties as any).stop_times,
            shapes: data.shapes || (normalizedFeature.properties as any).shapes,
        };

        // If upstream provided expanded descriptors/metadata at root, use them
        if (data.vehicle_descriptor) vehicleData.vehicle_descriptor = data.vehicle_descriptor;
        if (data.run_number !== undefined) vehicleData.run_number = data.run_number;
        if (data.origin_timestamp) vehicleData.origin_timestamp = data.origin_timestamp;
        if (data.last_stop_sequence !== undefined) vehicleData.last_stop_sequence = data.last_stop_sequence;
        if (data.next_stop_name) vehicleData.next_stop_name = data.next_stop_name;

        vehicleData.is_static_fallback = isStatic;

        // Shape processing: Build a GeoJSON LineString directly
        if (vehicleData.shapes && !Array.isArray(vehicleData.shapes) && typeof vehicleData.shapes === 'object') {
            const shapesObj = vehicleData.shapes as { features?: ShapeFeature[] };
            if (shapesObj.features && shapesObj.features.length >= 2) {
                const coordinates = shapesObj.features
                    .filter((f: ShapeFeature) => f.geometry.type === 'Point')
                    .map((f: ShapeFeature) => f.geometry.coordinates);
                
                const routeName = vehicleData.route_short_name || '';
                const routeType = vehicleData.route_type || 0;
                
                // Important: Need to import getVehicleColor dynamically or statically in this file now
                // Wait, it's better to just use getVehicleColor which we can import at the top of the file!
                
                vehicleData.route_geojson = {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: coordinates
                        },
                        properties: {
                            line_color: getVehicleColor(routeType, routeName)
                        }
                    }]
                };
            }
        }
        delete vehicleData.shapes;

        return createSuccessResponse(vehicleData, CACHE_TTL.VEHICLE_DETAIL);
    } catch (error) {
        console.error("Vehicle Detail API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
