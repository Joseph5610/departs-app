import type { AppStopConnection, AppVehicleCollection, AppVehicleDetail, AppVehicleFeature } from '../../../../_core/types';
import type { GtfsRoute } from '../../core/gtfs-data';
import type { Station } from './types';
import { dayBit, operatesOnDay, type TripWindows } from '../../core/trip-windows';
import { normalizeRouteType } from '../../../../_core/utils/routeTypes';
import { DAY_MINS, toClockTime, type LocalClock } from '../../../../_core/utils/time';
import { isConnectionAtRisk } from '../../../../_core/utils/connections';
import { mapContinuation } from '../../core/continuations';

/** Turns the onward connections listed on a trip's stops into display rows with live data. */
export class TripConnectionsMapper {

    /**
     * The service day the viewed trip belongs to: yesterday while an overnight run is still under
     * way, else today when it runs today, otherwise the next covered day it runs on. 0 when the
     * windows cannot place it, which selects no connection.
     */
    static serviceDayBit(windows: TripWindows, tripId: string, clock: LocalClock): number {
        const window = windows.trips[tripId];
        if (!window) return 0;
        if (clock.mins < window[1] - DAY_MINS) {
            const bit = dayBit(windows, clock.previousDate);
            if (bit && operatesOnDay(window, bit)) return bit;
        }
        for (const day of windows.days) {
            if (day < clock.date) continue;
            const bit = dayBit(windows, day);
            if (operatesOnDay(window, bit)) return bit;
        }
        return 0;
    }

    /**
     * Sets `connections` on each stop feature whose station lists onward trips, keeping only the
     * calendar variant running on the viewed trip's service day, and `continues_as` where the
     * vehicle continues as another trip. Connections need `windows`; continuations do not.
     */
    static attach(
        detail: AppVehicleDetail,
        stations: Station[],
        routes: Record<string, GtfsRoute>,
        windows: TripWindows | null,
        live: AppVehicleCollection | null,
        clock: LocalClock
    ): void {
        const features = detail.stop_times?.features;
        if (!features) return;

        const bit = windows ? this.serviceDayBit(windows, detail.gtfs_trip_id, clock) : 0;

        const stationBySequence = new Map<number, Station>();
        for (const s of stations) stationBySequence.set(s.sequence, s);

        const liveByTrip = new Map<string, NonNullable<AppVehicleFeature['properties']>>();
        for (const f of live?.features ?? []) {
            if (f.properties.gtfs_trip_id) liveByTrip.set(f.properties.gtfs_trip_id, f.properties);
        }

        const delay = typeof detail.delay === 'number' ? detail.delay : null;

        for (const feature of features) {
            const station = stationBySequence.get(feature.properties.stop_sequence);
            if (station?.continues_as) {
                const continuation = mapContinuation(station.continues_as, routes, liveByTrip);
                feature.properties.continues_as = {
                    ...continuation,
                    departure_time: continuation.departure_time && toClockTime(continuation.departure_time),
                };
            }
            if (!station?.connections || !windows || !bit) continue;

            const arrivalTime = station.arrival_time || station.departure_time;
            const rows: AppStopConnection[] = [];
            for (const [toTripId, routeId, headsign, departureTime, minTransferS, maxWaitS] of station.connections) {
                const window = windows.trips[toTripId];
                if (!window || !operatesOnDay(window, bit)) continue;

                const route = routes[routeId];
                const onward = liveByTrip.get(toTripId);
                rows.push({
                    trip_id: toTripId,
                    vehicle_id: onward?.vehicle_id || undefined,
                    line: route ? String(route.name) : routeId,
                    route_color: route?.route_color,
                    type: normalizeRouteType(route ? route.type : 'unknown'),
                    headsign,
                    departure_time: toClockTime(departureTime),
                    delay: typeof onward?.delay === 'number' ? onward.delay : null,
                    max_wait_s: maxWaitS,
                    at_risk: isConnectionAtRisk(arrivalTime, delay, minTransferS, departureTime, maxWaitS),
                });
            }
            if (rows.length > 0) feature.properties.connections = rows;
        }
    }
}
