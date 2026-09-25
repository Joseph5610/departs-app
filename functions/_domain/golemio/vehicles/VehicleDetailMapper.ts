import { AppVehicleDetail, AppStopTimeProperties, AppVehicleDescriptor } from "../../../_core/types";
import type { GolemioVehicleDetailPayload } from "../../../_feeds/golemio/schemas/vehicles";
import { normalizeRouteType } from "../../../_core/utils/routeTypes";
import { isFields, str, num, bool, strOrNum, type Fields } from "./fields";

/** `vehicle_descriptor`, read defensively; every field optional, matching `AppVehicleDescriptor`. */
function readDescriptor(v: unknown): AppVehicleDescriptor | undefined {
    if (!isFields(v)) return undefined;
    const descriptor: AppVehicleDescriptor = {};
    const operator = str(v.operator);
    const vehicle_type = str(v.vehicle_type);
    const is_wheelchair_accessible = bool(v.is_wheelchair_accessible);
    const is_air_conditioned = bool(v.is_air_conditioned);
    const has_usb_chargers = bool(v.has_usb_chargers);
    const registration = strOrNum(v.vehicle_registration_number);
    if (operator != null) descriptor.operator = operator;
    if (vehicle_type != null) descriptor.vehicle_type = vehicle_type;
    if (is_wheelchair_accessible != null) descriptor.is_wheelchair_accessible = is_wheelchair_accessible;
    if (is_air_conditioned != null) descriptor.is_air_conditioned = is_air_conditioned;
    if (has_usb_chargers != null) descriptor.has_usb_chargers = has_usb_chargers;
    if (registration != null) descriptor.vehicle_registration_number = registration;
    return Object.keys(descriptor).length > 0 ? descriptor : undefined;
}

/** A bare `{type, coordinates}` geometry of any GeoJSON type, kept as-is (unlike `readPoint`, which only accepts `Point`). */
function readGeometry(v: unknown): { type: string; coordinates: number[] | number[][] } | undefined {
    if (!isFields(v) || typeof v.type !== 'string' || !Array.isArray(v.coordinates)) return undefined;
    return { type: v.type, coordinates: v.coordinates as number[] | number[][] };
}

type StopTimeFeature = NonNullable<AppVehicleDetail['stop_times']>['features'][number];

/** One `stop_times.features[]` entry, read defensively. Null when it carries no usable stop_id. */
function readStopTimeFeature(v: unknown): StopTimeFeature | null {
    if (!isFields(v) || !isFields(v.properties)) return null;
    const p = v.properties;
    const properties: AppStopTimeProperties = {
        stop_id: str(p.stop_id) || '',
        stop_name: str(p.stop_name) || '',
        stop_sequence: num(p.stop_sequence) ?? 0,
        arrival_time: str(p.arrival_time) || '',
        departure_time: str(p.departure_time) || '',
    };
    const realtime_arrival_time = str(p.realtime_arrival_time);
    const realtime_departure_time = str(p.realtime_departure_time);
    const zone_id = str(p.zone_id);
    const is_wheelchair_accessible = bool(p.is_wheelchair_accessible);
    const shape_dist_traveled = num(p.shape_dist_traveled);
    if (realtime_arrival_time != null) properties.realtime_arrival_time = realtime_arrival_time;
    if (realtime_departure_time != null) properties.realtime_departure_time = realtime_departure_time;
    if (zone_id != null) properties.zone_id = zone_id;
    if (is_wheelchair_accessible != null) properties.is_wheelchair_accessible = is_wheelchair_accessible;
    if (shape_dist_traveled != null) properties.shape_dist_traveled = shape_dist_traveled;

    return { type: 'Feature', geometry: readGeometry(v.geometry), properties };
}

/**
 * Mapper for parsing vehicle details from the Golemio API.
 *
 * Supports two payload shapes:
 * 1. Live GTFS-Realtime `vehiclepositions` (position and delay).
 * 2. Static GTFS schedule fallback (used when live data is missing).
 *
 * The payload is only shape-checked upstream (`golemioVehicleDetailSchema`), so every field is read
 * defensively here instead.
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
    static map(data: GolemioVehicleDetailPayload, tripId: string, requestedVehicleId: string | null, isStatic: boolean): AppVehicleDetail {
        // Golemio returns either a FeatureCollection or a bare Feature; extract whichever shape we got.
        const rawFeatures = Array.isArray(data.features) ? data.features : null;
        const feature = rawFeatures && isFields(rawFeatures[0]) ? rawFeatures[0] as Fields : undefined;
        const p: Fields = feature && isFields(feature.properties) ? feature.properties : data;
        const geometry = readGeometry(feature ? feature.geometry : data.geometry);

        const vehicleIdField = strOrNum(p.vehicle_id);
        const idField = strOrNum(p.id);
        const extracted_vehicle_id = vehicleIdField != null ? String(vehicleIdField) : (idField != null ? String(idField) : '');
        const gtfs_trip_id = str(p.gtfs_trip_id) || tripId;
        const route_short_name = str(p.route_short_name) || '';
        const route_type = normalizeRouteType(strOrNum(p.route_type) || '');
        const trip_headsign = str(p.trip_headsign) || '';
        const bearing = num(p.bearing) ?? null;
        const delay = num(p.delay) ?? 0;
        const state_position = (str(p.state_position) ?? 'unknown') as AppVehicleDetail['state_position'];

        const run_number = strOrNum(p.run_number) ?? '';
        const last_stop_sequence = num(data.last_stop_sequence) ?? num(p.last_stop_sequence) ?? 0;
        const origin_timestamp = str(data.origin_timestamp) ?? str(p.origin_timestamp);

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
            vehicle_descriptor: readDescriptor(data.vehicle_descriptor) ?? readDescriptor(p.vehicle_descriptor),
            geometry: geometry ? { type: 'Point', coordinates: geometry.coordinates as [number, number] } : undefined,
            is_static_fallback: isStatic,
            shape_dist_traveled: num(p.shape_dist_traveled) ?? num(data.shape_dist_traveled),
        };

        // Stop times: the schedule of stops for this trip.
        const stopTimesFeatures = isFields(data.stop_times) && Array.isArray(data.stop_times.features)
            ? data.stop_times.features
            : null;
        if (stopTimesFeatures) {
            const features = [];
            for (const raw of stopTimesFeatures) {
                const st = readStopTimeFeature(raw);
                if (st) features.push(st);
            }
            vehicleData.stop_times = { features };
        }

        return vehicleData;
    }
}
