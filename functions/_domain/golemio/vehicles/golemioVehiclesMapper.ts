import { AppVehicleFeature, AppVehicleCollection, AppVehicleDescriptor } from "../../../_core/types";
import type { GolemioVehiclePositionsPayload } from "../../../_feeds/golemio/schemas/vehicles";
import { normalizeRouteType } from "../../../_core/utils/routeTypes";
import { isFields, str, num, bool, strOrNum, readPoint } from "../../../_core/utils/fields";

/**
 * The Golemio fleet as app features; fields are read type-checked, as the feed is only shape-checked upstream.
 * `generatedAt` stands in for `last_updated` when the feed carries no per-vehicle timestamps.
 */
export function mapGolemioVehicles(data: GolemioVehiclePositionsPayload, generatedAt?: string): AppVehicleCollection {
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
            const vd = p.vehicle_descriptor;
            const registration = strOrNum(vd.vehicle_registration_number);
            vehicle_descriptor = {
                operator: str(vd.operator),
                vehicle_type: str(vd.vehicle_type),
                is_wheelchair_accessible: bool(vd.is_wheelchair_accessible),
                is_air_conditioned: bool(vd.is_air_conditioned),
                has_usb_chargers: bool(vd.has_usb_chargers),
                vehicle_registration_number: registration != null ? String(registration) : undefined,
            };
        }

        const trip_headsign = str(p.gtfs_trip_headsign) || str(p.trip_headsign);
        const vehicle_id = strOrNum(p.vehicle_id);
        const last_stop_sequence = num(p.last_stop_sequence);
        const run_number = strOrNum(p.run_number);

        // Absent fields stay as undefined keys, which JSON drops: every feature keeps one shape, which V8 maps and serializes faster.
        features.push({
            type: 'Feature',
            geometry: readPoint(f.geometry),
            properties: {
                vehicle_id: vehicle_id ? String(vehicle_id) : null,
                gtfs_trip_id: str(p.gtfs_trip_id) || '',
                route_short_name,
                route_type,
                trip_headsign: trip_headsign || undefined,
                bearing: num(p.bearing) ?? null,
                delay: num(p.delay) ?? null,
                state_position: (str(p.state_position) || 'unknown') as AppVehicleFeature['properties']['state_position'],
                last_stop_sequence: last_stop_sequence ?? undefined,
                origin_timestamp,
                run_number: run_number ?? undefined,
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
