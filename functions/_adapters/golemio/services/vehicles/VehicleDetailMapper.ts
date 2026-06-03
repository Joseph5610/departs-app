import { AppVehicleDetail } from "../../../../_core/types";
import { GolemioVehiclePayload, GolemioStopTimeFeature, GolemioShapeFeature, GolemioVehicleProperties } from "./types";
import { fixCommaSpacing } from "../../../../_core/api-utils";
import { getVehicleColor, isNightRoute } from "./colors";
import { getMetroLinesForStop, getMetroLinesForHeadsign } from "../stops/enrichment";

/**
 * Mapper for parsing vehicle details from the Golemio API.
 * 
 * Supports two payload shapes:
 * 1. Live GTFS-Realtime `vehiclepositions` (which contains position/delay data but lacks route shapes).
 * 2. Static GTFS schedule fallback (used when live data is missing).
 */
export class VehicleDetailMapper {
    /**
     * Normalizes a Golemio vehicle detail payload into a standard AppVehicleDetail object.
     * 
     * @param data Raw payload from Golemio API
     * @param tripId The requested trip ID
     * @param isStatic If true, indicates this data comes from static schedules and live tracking is unavailable.
     *                 The frontend must preserve any existing live position data when merging this.
     * @returns Normalized vehicle detail object
     */
    static map(data: GolemioVehiclePayload, tripId: string, isStatic: boolean): AppVehicleDetail {
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
        const state_position = p.state_position || 'unknown';
        const next_stop_name = fixCommaSpacing(p.next_stop_name || data.next_stop_name) || '';
        
        const vd = data.vehicle_descriptor || p.vehicle_descriptor || {};

        const run_number = String(p.run_number || '');
        const last_stop_sequence = Number(data.last_stop_sequence || p.last_stop_sequence || 0);
        const origin_timestamp = data.origin_timestamp || p.origin_timestamp;

        const routeColor = getVehicleColor(String(route_type), route_short_name);
        const is_night = isNightRoute(route_short_name);

        const vehicleData: AppVehicleDetail = {
            vehicle_id: extracted_vehicle_id || gtfs_trip_id,
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

        // Process Stop Times (The schedule of stops for this trip)
        const stopTimesData = data.stop_times;
        if (stopTimesData?.features) {
            vehicleData.stop_times = {
                features: stopTimesData.features.map((st: GolemioStopTimeFeature) => {
                    const stProps = st.properties || {};
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

        // Shape processing: Reconstruct a continuous LineString from individual shape points
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

        return vehicleData;
    }
}
