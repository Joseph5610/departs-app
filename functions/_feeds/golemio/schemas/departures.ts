import { z } from 'zod';
import { bool, isFields, num, str, strOrNum } from '../../../_core/utils/fields';

/** Shape check only: groups of items, each read field by field by `readDepartureItem`. */
export const golemioDepartureBoardsSchema = z.array(z.array(z.unknown()));

export interface GolemioDepartureItem {
    departure: { timestamp_predicted?: string | null; timestamp_scheduled: string; delay_seconds?: number | null; minutes?: number | null };
    route: { short_name: string; type: string | number };
    trip: { id: string; direction_id?: string | number | null; headsign: string; is_canceled: boolean };
    stop: { id: string; platform_code?: string | null; sequence?: number | null };
    vehicle?: { id?: string | null; is_wheelchair_accessible?: boolean | null; is_air_conditioned?: boolean | null; has_charger?: boolean | null };
}

/**
 * One departure-board item, every field type-checked as it is read; null when a required one is
 * missing or of the wrong type. A board is dozens of items: a schema per item cost more than the rest of the request.
 */
export function readDepartureItem(raw: unknown): GolemioDepartureItem | null {
    if (!isFields(raw) || !isFields(raw.departure) || !isFields(raw.route) || !isFields(raw.trip) || !isFields(raw.stop)) return null;
    const { departure, route, trip, stop } = raw;
    const timestampScheduled = str(departure.timestamp_scheduled);
    const shortName = str(route.short_name);
    const routeType = strOrNum(route.type);
    const tripId = str(trip.id);
    const headsign = str(trip.headsign);
    const isCanceled = bool(trip.is_canceled);
    const stopId = str(stop.id);
    if (timestampScheduled === undefined || shortName === undefined || routeType === undefined || tripId === undefined
        || headsign === undefined || isCanceled === undefined || stopId === undefined) return null;

    const vehicle = isFields(raw.vehicle) ? raw.vehicle : undefined;
    return {
        departure: { timestamp_predicted: str(departure.timestamp_predicted) ?? null, timestamp_scheduled: timestampScheduled, delay_seconds: num(departure.delay_seconds) ?? null, minutes: num(departure.minutes) ?? null },
        route: { short_name: shortName, type: routeType },
        trip: { id: tripId, direction_id: strOrNum(trip.direction_id) ?? null, headsign, is_canceled: isCanceled },
        stop: { id: stopId, platform_code: str(stop.platform_code) ?? null, sequence: num(stop.sequence) ?? null },
        ...(vehicle ? { vehicle: { id: str(vehicle.id) ?? null, is_wheelchair_accessible: bool(vehicle.is_wheelchair_accessible) ?? null, is_air_conditioned: bool(vehicle.is_air_conditioned) ?? null, has_charger: bool(vehicle.has_charger) ?? null } } : {}),
    };
}
