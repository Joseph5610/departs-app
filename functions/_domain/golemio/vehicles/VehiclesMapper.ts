import { AppVehicleFeature, AppVehicleCollection, AppVehicleDescriptor } from "../../../_core/types";
import type { GolemioFleetPayload } from "../../../_feeds/golemio/schemas/vehicles";
import { normalizeRouteType } from "../../../_core/utils/routeTypes";
import { isFields, str, num, bool, strOrNum, readPoint } from "./fields";

export class VehiclesMapper {
    /** `generatedAt` stands in for `last_updated` when the feed carries no per-vehicle timestamps. */
    /** Features are only shape-checked upstream, so every field is read with its type checked here. */
    static map(data: GolemioFleetPayload, generatedAt?: string): AppVehicleCollection {
        let maxTimeUpdatedStr = '';
        const features: AppVehicleFeature[] = [];

        const rawFeatures = data.features;
        if (!rawFeatures) return { type: 'FeatureCollection', features };

        const len = rawFeatures.length;

        for (let i = 0; i < len; i++) {
            const f = rawFeatures[i];
            if (!isFields(f) || !isFields(f.properties)) continue;

            const p = f.properties;
            const route_type = normalizeRouteType(strOrNum(p.route_type) || '');
            const route_short_name = str(p.gtfs_route_short_name) || str(p.route_short_name) || '';
            const origin_timestamp = str(p.origin_timestamp);

            if (origin_timestamp && origin_timestamp > maxTimeUpdatedStr) {
                maxTimeUpdatedStr = origin_timestamp;
            }

            let vehicle_descriptor: AppVehicleDescriptor | undefined = undefined;
            if (isFields(p.vehicle_descriptor)) {
                vehicle_descriptor = {} as AppVehicleDescriptor;
                const vd = p.vehicle_descriptor;
                const operator = str(vd.operator);
                const vehicle_type = str(vd.vehicle_type);
                const is_wheelchair_accessible = bool(vd.is_wheelchair_accessible);
                const is_air_conditioned = bool(vd.is_air_conditioned);
                const has_usb_chargers = bool(vd.has_usb_chargers);
                const registration = strOrNum(vd.vehicle_registration_number);
                if (operator != null) vehicle_descriptor.operator = operator;
                if (vehicle_type != null) vehicle_descriptor.vehicle_type = vehicle_type;
                if (is_wheelchair_accessible != null) vehicle_descriptor.is_wheelchair_accessible = is_wheelchair_accessible;
                if (is_air_conditioned != null) vehicle_descriptor.is_air_conditioned = is_air_conditioned;
                if (has_usb_chargers != null) vehicle_descriptor.has_usb_chargers = has_usb_chargers;
                if (registration != null) vehicle_descriptor.vehicle_registration_number = String(registration);
            }

            const trip_headsign = str(p.gtfs_trip_headsign) || str(p.trip_headsign);
            const vehicle_id = strOrNum(p.vehicle_id);
            const last_stop_sequence = num(p.last_stop_sequence);
            const run_number = strOrNum(p.run_number);

            features.push({
                type: 'Feature',
                geometry: readPoint(f.geometry),
                properties: {
                    vehicle_id: vehicle_id ? String(vehicle_id) : null,
                    gtfs_trip_id: str(p.gtfs_trip_id) || '',
                    route_short_name,
                    route_type,
                    ...(trip_headsign ? { trip_headsign } : {}),
                    bearing: num(p.bearing) ?? null,
                    delay: num(p.delay) ?? null,
                    state_position: (str(p.state_position) || 'unknown') as AppVehicleFeature['properties']['state_position'],
                    ...(last_stop_sequence != null ? { last_stop_sequence } : {}),
                    origin_timestamp,
                    ...(run_number != null ? { run_number } : {}),
                    vehicle_descriptor
                }
            });
        }

        // No `status` here: `withFeedAge` and `vehiclesBody` stamp it from when the snapshot was read.
        const maxTimeUpdated = maxTimeUpdatedStr ? new Date(maxTimeUpdatedStr).getTime() : 0;

        return {
            type: 'FeatureCollection',
            features,
            last_updated: maxTimeUpdated > 0 ? new Date(maxTimeUpdated).toISOString() : generatedAt
        };
    }
}
