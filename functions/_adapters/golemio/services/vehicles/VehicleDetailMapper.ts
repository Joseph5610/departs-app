import { AppVehicleDetail, AppStopTimeProperties, AppRouteFeature, AppVehicleDescriptor } from "../../../../_core/types";
import { GolemioVehiclePayload, GolemioStopTimeFeature, GolemioShapeFeature } from "./schemas";
import { fixCommaSpacing } from "../../../../_core/api-utils";
import { getVehicleColor } from "./colors";
import { ProcessedEnrichmentData } from "../stops/enrichment";
import { normalizeRouteType } from "../../../../_core/utils/routeTypes";

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
    static map(data: GolemioVehiclePayload, tripId: string, requestedVehicleId: string | null, isStatic: boolean, enrichmentData: ProcessedEnrichmentData): AppVehicleDetail {
        // Golemio returns either a FeatureCollection or a bare Feature.
        // Extract properties from whichever shape we received.
        const feature = data.features?.[0];
        const p = feature?.properties ?? data;
        const geometry = feature?.geometry ?? data.geometry;
        const extracted_vehicle_id = p.vehicle_id ? String(p.vehicle_id) : (p.id ? String(p.id) : '');
        const gtfs_trip_id = p.gtfs_trip_id || tripId;
        const route_short_name = p.route_short_name || '';
        const route_type = normalizeRouteType(p.route_type || '');
        const trip_headsign = fixCommaSpacing(p.trip_headsign) || '';
        const bearing = p.bearing ?? null;
        const delay = p.delay ?? 0;
        const state_position = (p.state_position ?? 'unknown') as AppVehicleDetail['state_position'];
        
        const run_number = p.run_number || '';
        const last_stop_sequence = data.last_stop_sequence ?? p.last_stop_sequence ?? 0;
        const origin_timestamp = data.origin_timestamp ?? p.origin_timestamp;

        const routeColor = getVehicleColor(route_type, route_short_name);

        const vehicleData: AppVehicleDetail = {
            vehicle_id: extracted_vehicle_id || requestedVehicleId || null,
            gtfs_trip_id,
            route_short_name,
            route_type,
            trip_headsign,
            bearing,
            delay,
            state_position,
            last_stop_sequence,
            origin_timestamp: origin_timestamp ?? undefined,
            run_number,
            route_color: routeColor,
            vehicle_descriptor: (() => {
                const desc = data.vehicle_descriptor || p.vehicle_descriptor;
                if (!desc) return undefined;
                return Object.fromEntries(Object.entries(desc).filter(([_, v]) => v != null)) as AppVehicleDescriptor;
            })(),
            geometry: geometry ?? undefined,
            is_static_fallback: isStatic,
            shape_dist_traveled: p.shape_dist_traveled ?? (data as { shape_dist_traveled?: number }).shape_dist_traveled ?? undefined,
        };

        // Process Stop Times (The schedule of stops for this trip)
        if (data.stop_times && Array.isArray(data.stop_times.features)) {
            vehicleData.stop_times = {
                features: data.stop_times.features
                    .filter((st: GolemioStopTimeFeature | null): st is GolemioStopTimeFeature => st != null && st.properties != null)
                    .map((st) => {
                        const stProps = st.properties;
                    const stopId = stProps.stop_id || '';
                    const stopName = stProps.stop_name;
                    let metroLines = enrichmentData.stopIdToMetroLines.get(stopId) || [];
                    
                    if (metroLines.length === 0 && stopName) {
                        metroLines = enrichmentData.headsignLookup.get(stopName.trim().toUpperCase()) || [];
                    }

                    return {
                        type: 'Feature' as const,
                        geometry: st.geometry ?? undefined,
                        properties: {
                            ...Object.fromEntries(Object.entries(stProps).filter(([_, v]) => v != null)),
                            stop_id: stopId,
                            ...(metroLines.length > 0 ? { metro_lines: metroLines } : {})
                        } as AppStopTimeProperties
                    };
                })
            };
        }

        // Shape and Stops processing: Reconstruct a continuous LineString and add Stop points
        const routeFeatures: AppRouteFeature[] = [];

        const shapes = data.shapes;
        if (shapes) {
            const shapesFeatures = 'features' in shapes ? shapes.features : (Array.isArray(shapes) ? shapes : null);
            
            if (shapesFeatures && shapesFeatures.length >= 2) {
                const validFeatures = shapesFeatures.filter((sf: GolemioShapeFeature) => sf.geometry?.type === 'Point');
                const coordinates = validFeatures.map((sf: GolemioShapeFeature) => sf.geometry.coordinates as [number, number]);
                const shapeDists = validFeatures.map((sf: GolemioShapeFeature) => sf.properties?.shape_dist_traveled ?? 0);
                
                routeFeatures.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    },
                    properties: {
                        route_color: routeColor,
                        shape_dist_traveled: shapeDists
                    }
                });
            }
        }

        const validStops = vehicleData.stop_times?.features
            ?.filter(st => st.geometry && st.geometry.type === 'Point' && Array.isArray(st.geometry.coordinates)) || [];

        validStops.forEach((st: typeof validStops[0], index: number) => {
            const isTerminal = index === 0 || index === validStops.length - 1;
            if (st.geometry) {
                routeFeatures.push({
                    type: 'Feature',
                    geometry: st.geometry as { type: 'Point'; coordinates: number[] },
                    properties: {
                        route_color: routeColor,
                        is_terminal: isTerminal
                    }
                });
            }
        });

        if (routeFeatures.length > 0) {
            vehicleData.route_geojson = {
                type: 'FeatureCollection',
                features: routeFeatures
            } as NonNullable<AppVehicleDetail['route_geojson']>;
        }

        return vehicleData;
    }
}
