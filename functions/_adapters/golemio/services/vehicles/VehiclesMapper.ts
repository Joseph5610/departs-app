import { AppVehicleFeature, AppVehicleCollection } from "../../../../_core/types";
import { GolemioVehiclePayload, GolemioVehicleFeature } from "./schemas";
import { fixCommaSpacing } from "../../../../_core/api-utils";
import { getVehicleColor, isNightRoute } from "./colors";

export class VehiclesMapper {
    static map(data: GolemioVehiclePayload): AppVehicleCollection {
        const features: AppVehicleFeature[] = (data.features || []).map((f: GolemioVehicleFeature) => {
            const p = f.properties;
            const route_type = p.route_type || '';
            const route_short_name = p.gtfs_route_short_name || p.route_short_name || '';

            return {
                type: 'Feature',
                geometry: f.geometry || null,
                properties: {
                    vehicle_id: p.vehicle_id ?? null,
                    gtfs_trip_id: p.gtfs_trip_id || '',
                    route_short_name,
                    route_type,
                    trip_headsign: fixCommaSpacing(p.gtfs_trip_headsign || p.trip_headsign) || '',
                    bearing: p.bearing ?? null,
                    delay: p.delay,
                    state_position: p.state_position,
                    next_stop_name: p.next_stop_name ? fixCommaSpacing(p.next_stop_name) || undefined : undefined,
                    last_stop_sequence: p.last_stop_sequence,
                    origin_timestamp: p.origin_timestamp,
                    run_number: p.run_number || '',
                    route_color: getVehicleColor(route_type, route_short_name),
                    is_night: isNightRoute(route_short_name),
                    vehicle_descriptor: p.vehicle_descriptor
                }
            };
        });

        return { type: 'FeatureCollection', features };
    }
}
