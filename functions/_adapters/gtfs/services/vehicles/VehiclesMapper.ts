import type { AppVehicleFeature, AppVehicleProperties } from '../../../../_core/types';
import type { transit_realtime } from 'gtfs-realtime-bindings';
import type { GtfsRoute } from '../../core/gtfs-data';
import { normalizeRouteType } from '../../../../_core/utils/routeTypes';

export class VehiclesMapper {
    static mapVehicle(
        vehicleObj: transit_realtime.IVehiclePosition,
        tripId: string,
        route: GtfsRoute,
        lastUpdate: number,
        delay: number | null
    ): AppVehicleFeature {
        const vp = vehicleObj;
        
        let statePosition: AppVehicleProperties['state_position'] = 'on_track';
        // '0' = INCOMING_AT, '1' = STOPPED_AT, '2' = IN_TRANSIT_TO
        if (vp.currentStatus === 0) {
            statePosition = 'on_track'; // INCOMING_AT maps closely to on_track
        } else if (vp.currentStatus === 1) {
            statePosition = 'at_stop';
            
            // Heuristic for before_track: if stopped at the very first stop of the sequence
            // Only trigger if > 0 because missing currentStopSequence defaults to 0 in protobuf
            if (vp.currentStopSequence === 1) {
                const delaySecs = delay ?? 0;
                statePosition = delaySecs > 60 ? 'before_track_delayed' : 'before_track';
            }
        }

        const bearing = vp.position?.bearing ? Number(vp.position.bearing) : undefined;
        const vehicleId = vp.vehicle?.id || '';
        const vehicleLabel = vp.vehicle?.label || vehicleId;
        const licensePlate = vp.vehicle?.licensePlate;
        
        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [Number(vp.position?.longitude || 0), Number(vp.position?.latitude || 0)]
            },
            properties: {
                gtfs_trip_id: tripId,
                vehicle_id: vehicleLabel.toString(),
                
                route_short_name: route.short_name || route.name || '',
                route_color: route.route_color || '',
                route_type: normalizeRouteType(route.type),
                
                delay: delay ?? null,
                state_position: statePosition,
                origin_timestamp: new Date(lastUpdate).toISOString(),
                bearing: bearing ?? null,
                
                ...(vp.currentStopSequence && vp.currentStopSequence > 0 ? { last_stop_sequence: vp.currentStopSequence } : {}),
                
                vehicle_descriptor: {
                    vehicle_registration_number: licensePlate || vehicleLabel || vehicleId
                }
            }
        };
    }
}
