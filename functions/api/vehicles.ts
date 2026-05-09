import { Env, GolemioVehiclePayload, AppVehicleFeature, GolemioVehicleFeature } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, golemioFetch, createErrorResponse, createSuccessResponse, fixCommaSpacing } from "../_utils/api-utils";
import { getVehicleColor, isNightRoute } from "../_utils/vehicle-colors";


export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const { searchParams } = new URL(request.url);

    const bounds = searchParams.get("bounds");
    const routeTypes = searchParams.getAll("routeType");
    const routeShortNames = searchParams.getAll("routeShortName");

    if (!bounds && routeShortNames.length === 0 && routeTypes.length === 0) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    try {
        const params: Record<string, string | string[]> = {};
        if (bounds) params.boundingBox = bounds;
        if (routeTypes.length > 0) params.routeType = routeTypes;
        if (routeShortNames.length > 0) params.routeShortName = routeShortNames;

        const response = await golemioFetch("/v2/public/vehiclepositions", env, {
            searchParams: params,
            cacheTtl: CACHE_TTL.VEHICLES
        });

        if (!response.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data = await response.json() as GolemioVehiclePayload;

        const features: AppVehicleFeature[] = (data.features || []).map((f: GolemioVehicleFeature) => {
            const p = f.properties;
            const route_type = String(p.route_type || '');
            const route_short_name = p.gtfs_route_short_name || p.route_short_name || '';

            return {
                type: 'Feature',
                geometry: f.geometry || null,
                properties: {
                    vehicle_id: String(p.vehicle_id || p.id || ''),
                    gtfs_trip_id: p.gtfs_trip_id || '',
                    route_short_name,
                    route_type,
                    trip_headsign: fixCommaSpacing(p.gtfs_trip_headsign || p.trip_headsign) || '',
                    bearing: p.bearing !== undefined ? Number(p.bearing) : null,
                    delay: p.delay !== undefined ? Number(p.delay) : 0,
                    state_position: p.state_position,
                    next_stop_name: fixCommaSpacing(p.next_stop_name),
                    last_stop_sequence: Number(p.last_stop_sequence || 0),
                    origin_timestamp: p.origin_timestamp,
                    run_number: String(p.run_number || ''),
                    route_color: getVehicleColor(route_type, route_short_name),
                    is_night: isNightRoute(route_short_name),
                    vehicle_descriptor: {
                        operator: p.vehicle_descriptor?.operator,
                        vehicle_type: p.vehicle_descriptor?.vehicle_type,
                        is_wheelchair_accessible: p.vehicle_descriptor?.is_wheelchair_accessible,
                        is_air_conditioned: p.vehicle_descriptor?.is_air_conditioned,
                        has_usb_chargers: p.vehicle_descriptor?.has_usb_chargers,
                        vehicle_registration_number: p.vehicle_descriptor?.vehicle_registration_number
                    }
                }
            };
        });

        return createSuccessResponse({ type: 'FeatureCollection', features }, CACHE_TTL.VEHICLES);

    } catch (error) {
        console.error("Vehicles API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
