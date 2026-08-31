import type { AppVehicleFeature, AppVehicleProperties } from '../../../../_core/types';
import type { transit_realtime } from 'gtfs-realtime-bindings';
import type { GtfsRoute } from '../../core/gtfs-data';
import { normalizeRouteType } from '../../../../_core/utils/routeTypes';

export class VehiclesMapper {
    static mapVehicle(
        vehicleObj: transit_realtime.IVehiclePosition,
        tripId: string,
        route: GtfsRoute,
        originTimestamp: string,
        delay: number | null,
        isBeforeTrack: boolean = false
    ): AppVehicleFeature {
        const vp = vehicleObj;
        
        let statePosition: AppVehicleProperties['state_position'] = 'on_track';
        
        if (isBeforeTrack) {
            const delaySecs = delay ?? 0;
            statePosition = delaySecs > 60 ? 'before_track_delayed' : 'before_track';
        } else if (vp.currentStatus === 1) { // 1 = STOPPED_AT
            statePosition = 'at_stop';
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
                origin_timestamp: originTimestamp,
                bearing: bearing ?? null,
                
                ...(vp.currentStopSequence && vp.currentStopSequence > 0 ? { last_stop_sequence: vp.currentStopSequence } : {}),
                
                vehicle_descriptor: {
                    vehicle_registration_number: licensePlate || vehicleLabel || vehicleId
                }
            }
        };
    }
}
