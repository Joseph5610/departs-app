import type { AppVehicleFeature, AppVehicleProperties } from "../../../../_core/types";
import { isNightRoute } from '../../../golemio/services/vehicles/colors';
import type { transit_realtime } from "gtfs-realtime-bindings";
import type { GtfsRoute } from '../../core/gtfs-data';

export class VehiclesMapper {
    static mapVehicles(
        feed: transit_realtime.FeedMessage,
        routes: Record<string, GtfsRoute>,
        tripRoutes: Record<string, string>
    ): AppVehicleFeature[] {
        const vehiclesMap = new Map<string, AppVehicleFeature>();
        
        const now = new Date();
        const hour = now.getUTCHours() + 2; // Approximate local time (Prague/Brno)
        const isNightTime = hour >= 23 || hour < 5;

        for (const entity of feed.entity) {
            if (entity.vehicle && entity.vehicle.position) {
                const vp = entity.vehicle;
                const tripId = vp.trip?.tripId;
                if (!tripId) continue;
                
                const routeId = tripRoutes[tripId];
                if (!routeId) continue;
                
                const route = routes[routeId];
                if (!route) continue;

                let status = 'running';
                const currentStatus = vp.currentStatus;
                if (currentStatus === 1) status = 'at_stop';

                const STALE_VEHICLE_TIMEOUT_SECS = 1800; // 30 minutes
                const ts = Number(vp.timestamp);
                if (ts && (Math.floor(Date.now() / 1000) - ts) > STALE_VEHICLE_TIMEOUT_SECS) continue;

                const vehicleId = vp.vehicle?.licensePlate || vp.vehicle?.id || entity.id;
                const isNight = route.name.toUpperCase().startsWith('N') || isNightRoute(route.name);

                const feature: AppVehicleFeature = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [vp.position?.longitude || 0, vp.position?.latitude || 0]
                    },
                    properties: {
                        id: vp.vehicle?.id || entity.id,
                        vehicle_id: vehicleId,
                        gtfs_trip_id: tripId,
                        line: route.name,
                        route_short_name: route.name,
                        route_type: Number(route.type),
                        trip_headsign: 'IDS JMK',
                        bearing: vp.position?.bearing || null,
                        delay: 0,
                        state_position: status,
                        current_stop_id: vp.stopId || null,
                        last_stop_sequence: vp.currentStopSequence || null,
                        is_tracking: true,
                        route_color: route.route_color || '#888888',
                        is_night: isNight,
                        origin_timestamp: vp.timestamp ? new Date(Number(vp.timestamp) * 1000).toISOString() : undefined,
                        vehicle_descriptor: {
                            operator: 'IDS JMK',
                            vehicle_registration_number: vp.vehicle?.label || vp.vehicle?.id
                        }
                    } as AppVehicleProperties & { current_stop_id: string | null }
                };

                // Deduplicate logic: prefer vehicles that have actually started their trip
                const existing = vehiclesMap.get(vehicleId);
                if (!existing) {
                    vehiclesMap.set(vehicleId, feature);
                } else {
                    const existingSeq = existing.properties.last_stop_sequence;
                    const newSeq = feature.properties.last_stop_sequence;
                    
                    if (newSeq != null && (existingSeq == null || newSeq > existingSeq)) {
                        vehiclesMap.set(vehicleId, feature);
                    } else if (newSeq == null && existingSeq == null) {
                        // If neither started, use time-based heuristic
                        // If it's night time, prefer night routes. If day time, prefer day routes.
                        const existingIsNight = existing.properties.is_night;
                        const newIsNight = feature.properties.is_night;
                        
                        if (isNightTime && newIsNight && !existingIsNight) {
                            vehiclesMap.set(vehicleId, feature);
                        } else if (!isNightTime && !newIsNight && existingIsNight) {
                            vehiclesMap.set(vehicleId, feature);
                        }
                    }
                }
            }
        }

        return Array.from(vehiclesMap.values());
    }
}
