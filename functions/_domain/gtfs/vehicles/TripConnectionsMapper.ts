import type { AppStopConnection, AppVehicleDetail } from '../../../_core/types';
import type { Station } from '../../../_feeds/gtfs/types';
import type { TripService } from '../../../_feeds/gtfs/trip-stops';
import { dayBit, flagsInclude, operatesOnDay } from '../../../_feeds/gtfs/schedule';
import { DAY_MINS, toClockTime, type LocalClock } from '../../../_core/utils/time';
import { isConnectionAtRisk } from '../../../_core/utils/connections';
import { mapContinuation } from '../../../_feeds/gtfs/continuations';

/** Turns the onward connections listed on a trip's stops into display rows; onward vehicles are attached by the app. */
export class TripConnectionsMapper {

    /**
     * The service day the viewed trip belongs to: yesterday while an overnight run is still under
     * way, else today when it runs today, otherwise the next covered day it runs on. 0 when the
     * bucket cannot place it, which selects no connection.
     */
    static serviceDayBit({ days, window }: TripService, clock: LocalClock): number {
        if (clock.mins < window[1] - DAY_MINS) {
            const bit = dayBit({ days }, clock.previousDate);
            if (bit && operatesOnDay(window, bit)) return bit;
        }
        for (const day of days) {
            if (day < clock.date) continue;
            const bit = dayBit({ days }, day);
            if (operatesOnDay(window, bit)) return bit;
        }
        return 0;
    }

    /**
     * Sets `connections` on each stop feature whose station lists onward trips, keeping only the
     * calendar variant running on the viewed trip's service day, and `continues_as` where the
     * vehicle continues as another trip. Connections need the trip's `service`; continuations do not.
     */
    static attach(
        detail: AppVehicleDetail,
        stations: Station[],
        service: TripService | null,
        clock: LocalClock
    ): void {
        const features = detail.stop_times?.features;
        if (!features) return;

        const bit = service ? this.serviceDayBit(service, clock) : 0;

        const stationBySequence = new Map<number, Station>();
        for (const s of stations) stationBySequence.set(s.sequence, s);

        const delay = typeof detail.delay === 'number' ? detail.delay : null;

        for (const feature of features) {
            const station = stationBySequence.get(feature.properties.stop_sequence);
            if (station?.continues_as) {
                const continuation = mapContinuation(station.continues_as);
                feature.properties.continues_as = {
                    ...continuation,
                    departure_time: continuation.departure_time && toClockTime(continuation.departure_time),
                };
            }
            if (!station?.connections || !bit) continue;

            const arrivalTime = station.arrival_time || station.departure_time;
            const rows: AppStopConnection[] = [];
            for (const [toTripId, routeId, headsign, departureTime, minTransferS, maxWaitS, dayFlags] of station.connections) {
                if (dayFlags === undefined || !flagsInclude(dayFlags, bit)) continue;

                rows.push({
                    trip_id: toTripId,
                    route_id: routeId,
                    headsign,
                    departure_time: toClockTime(departureTime),
                    delay: null,
                    max_wait_s: maxWaitS,
                    at_risk: isConnectionAtRisk(arrivalTime, delay, minTransferS, departureTime, maxWaitS),
                });
            }
            if (rows.length > 0) feature.properties.connections = rows;
        }
    }
}
