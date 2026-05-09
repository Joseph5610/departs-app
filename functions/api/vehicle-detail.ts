import { Env, GolemioVehiclePayload, AppVehicleDetail, GolemioStopTimeFeature, GolemioShapeFeature, GolemioVehicleProperties } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch, sanitizeId, fixCommaSpacing } from "../_utils/api-utils";
import { getVehicleColor, isNightRoute } from "../_utils/vehicle-colors";
import { getMetroLinesForStop, getMetroLinesForHeadsign } from "../_utils/enrichment";


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
            ({ response, isStatic } = await fetchStaticTrip());
        } else {
            response = await golemioFetch(`/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}`, env, {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                searchParams: { scopes }
            });

            if (!response.ok) {
                console.warn(`Real-time fetch failed (${response.status}), falling back to static GTFS for trip ${tripId}`);
                ({ response, isStatic } = await fetchStaticTrip());
            }
        }

        if (!response.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data = await response.json() as GolemioVehiclePayload;

        // Golemio returns either a FeatureCollection or a bare Feature.
        // Extract properties from whichever shape we received.
        const feature = data.features?.[0];
        const p: Partial<GolemioVehicleProperties> = feature?.properties ?? data;
        const geometry = feature?.geometry ?? data.geometry ?? null;
        const extracted_vehicle_id = p.vehicle_id ? String(p.vehicle_id) : (p.id ? String(p.id) : '');
        const gtfs_trip_id = p.gtfs_trip_id || tripId;
        const route_short_name = p.route_short_name || '';
        const route_type = p.route_type || '';
        const trip_headsign = fixCommaSpacing(p.trip_headsign) || '';
        const bearing = p.bearing !== undefined ? Number(p.bearing) : null;
        const delay = p.delay !== undefined ? Number(p.delay) : 0;
        const state_position = p.state_position;
        const next_stop_name = fixCommaSpacing(p.next_stop_name || data.next_stop_name);
        
        const vd = data.vehicle_descriptor || p.vehicle_descriptor || {};

        const run_number = String(p.run_number || '');
        const last_stop_sequence = Number(data.last_stop_sequence || p.last_stop_sequence || 0);
        const origin_timestamp = data.origin_timestamp || p.origin_timestamp;

        const routeColor = getVehicleColor(String(route_type), route_short_name);
        const is_night = isNightRoute(route_short_name);

        const vehicleData: AppVehicleDetail = {
            vehicle_id: extracted_vehicle_id,
            gtfs_trip_id,
            route_short_name,
            route_type,
            trip_headsign,
            bearing,
            delay,
            state_position,
            next_stop_name,
            last_stop_sequence,
            origin_timestamp,
            run_number,
            route_color: routeColor,
            is_night,
            vehicle_descriptor: {
                operator: vd.operator,
                vehicle_type: vd.vehicle_type,
                is_wheelchair_accessible: vd.is_wheelchair_accessible,
                is_air_conditioned: vd.is_air_conditioned,
                has_usb_chargers: vd.has_usb_chargers,
                vehicle_registration_number: vd.vehicle_registration_number
            },
            geometry,
            is_static_fallback: isStatic,
        };

        // Process Stop Times
        const stopTimesData = data.stop_times;
        if (stopTimesData?.features) {
            vehicleData.stop_times = {
                features: stopTimesData.features.map((st: GolemioStopTimeFeature) => {
                    const stProps = st.properties;
                    const stopId = stProps.stop_id;
                    const stopName = stProps.stop_name;
                    let metroLines = getMetroLinesForStop(stopId);
                    
                    if (metroLines.length === 0 && stopName) {
                        metroLines = getMetroLinesForHeadsign(stopName);
                    }

                    return {
                        type: 'Feature',
                        geometry: st.geometry,
                        properties: {
                            ...stProps,
                            metro_lines: metroLines
                        }
                    };
                })
            };
        }

        // Shape processing: Build a GeoJSON LineString
        const shapes = data.shapes;
        if (shapes) {
            const shapesFeatures = 'features' in shapes ? shapes.features : (Array.isArray(shapes) ? shapes : null);
            
            if (shapesFeatures && shapesFeatures.length >= 2) {
                const coordinates = shapesFeatures
                    .filter((sf: GolemioShapeFeature) => sf.geometry?.type === 'Point')
                    .map((sf: GolemioShapeFeature) => sf.geometry.coordinates as [number, number]);
                
                vehicleData.route_geojson = {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: coordinates
                        },
                        properties: {
                            route_color: routeColor
                        }
                    }]
                };
            }
        }

        return createSuccessResponse(vehicleData, CACHE_TTL.VEHICLE_DETAIL);
    } catch (error) {
        console.error("Vehicle Detail API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
