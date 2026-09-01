import { AppVehicleFeature, AppVehicleCollection, AppVehicleDescriptor } from "../../../../_core/types";
import { GolemioVehiclePayload } from "./schemas";
import { fixCommaSpacing } from "../../../../_core/api-utils";
import { getVehicleColor } from "./colors";
import { normalizeRouteType } from "../../../../_core/utils/routeTypes";

export class VehiclesMapper {
    static map(data: GolemioVehiclePayload): AppVehicleCollection {
        let maxTimeUpdatedStr = '';
        const features: AppVehicleFeature[] = [];

        const rawFeatures = data.features;
        if (!rawFeatures) return { type: 'FeatureCollection', features, status: 'ok' };

        const len = rawFeatures.length;

        for (let i = 0; i < len; i++) {
            const f = rawFeatures[i];
            if (!f || !f.properties) continue;

            const p = f.properties;
            const route_type = normalizeRouteType(p.route_type || '');
            const route_short_name = p.gtfs_route_short_name || p.route_short_name || '';

            if (p.origin_timestamp && p.origin_timestamp > maxTimeUpdatedStr) {
                maxTimeUpdatedStr = p.origin_timestamp;
            }

            let vehicle_descriptor: AppVehicleDescriptor | undefined = undefined;
            if (p.vehicle_descriptor) {
                vehicle_descriptor = {} as AppVehicleDescriptor;
                const vd = p.vehicle_descriptor;
                if (vd.operator != null) vehicle_descriptor.operator = vd.operator;
                if (vd.vehicle_type != null) vehicle_descriptor.vehicle_type = vd.vehicle_type;
                if (vd.is_wheelchair_accessible != null) vehicle_descriptor.is_wheelchair_accessible = vd.is_wheelchair_accessible;
                if (vd.is_air_conditioned != null) vehicle_descriptor.is_air_conditioned = vd.is_air_conditioned;
                if (vd.has_usb_chargers != null) vehicle_descriptor.has_usb_chargers = vd.has_usb_chargers;
                if (vd.vehicle_registration_number != null) vehicle_descriptor.vehicle_registration_number = String(vd.vehicle_registration_number);
            }

            features.push({
                type: 'Feature',
                geometry: f.geometry || null,
                properties: {
                    vehicle_id: p.vehicle_id ? String(p.vehicle_id) : null,
                    gtfs_trip_id: p.gtfs_trip_id || '',
                    route_short_name,
                    route_type,
                    ...(p.gtfs_trip_headsign || p.trip_headsign ? { trip_headsign: fixCommaSpacing(p.gtfs_trip_headsign || p.trip_headsign) } : {}),
                    bearing: p.bearing ?? null,
                    delay: p.delay ?? null,
                    state_position: (p.state_position || 'unknown') as AppVehicleFeature['properties']['state_position'],
                    ...(p.last_stop_sequence != null ? { last_stop_sequence: p.last_stop_sequence } : {}),
                    origin_timestamp: p.origin_timestamp ?? undefined,
                    ...(p.run_number != null ? { run_number: p.run_number } : {}),
                    route_color: getVehicleColor(route_type, route_short_name),
                    vehicle_descriptor
                }
            });
        }

        const maxTimeUpdated = maxTimeUpdatedStr ? new Date(maxTimeUpdatedStr).getTime() : 0;
        const THRESHOLD_MS = 10 * 60 * 1000;
        const isStale = maxTimeUpdated > 0 && (Date.now() - maxTimeUpdated > THRESHOLD_MS);
        const status = isStale ? 'stale' : 'ok';

        return { 
            type: 'FeatureCollection', 
            features,
            status,
            last_updated: maxTimeUpdated > 0 ? new Date(maxTimeUpdated).toISOString() : undefined
        };
    }
}
