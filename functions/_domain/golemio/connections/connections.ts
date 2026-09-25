import type { AppContinuation, AppDepartureFeeder, AppStopConnection, AppVehicleDetail } from "../../../_core/types";
import type { ContinuationRow, FeederRow, LiveConnections, TripConnections } from "../../../_feeds/golemio/connections";
import { DAY_SECS, getPreviousDateString, toSecs, type LocalClock } from "../../../_core/utils/time";
import { isConnectionAtRisk } from "../../../_core/utils/connections";
import { normalizeRouteType } from "../../../_core/utils/routeTypes";

const bitOf = (file: LiveConnections, dayStr: string): number => {
    const idx = file.days.indexOf(dayStr);
    return idx < 0 ? 0 : 1 << idx;
};

/**
 * The service day a trip occurrence belongs to. PID runs overnight trips on the previous day's
 * service with times past 24:00, so a stop time like `24:40:00` places it on the day before.
 */
function serviceDayBit(file: LiveConnections, trip: TripConnections, localDate: string, isPastMidnightTime: boolean): number {
    const today = bitOf(file, localDate);
    const yesterday = bitOf(file, getPreviousDateString(localDate));
    if (isPastMidnightTime && (trip.d & yesterday)) return yesterday;
    if (trip.d & today) return today;
    return trip.d & yesterday ? yesterday : 0;
}

const isPastMidnight = (time: string | null | undefined): boolean => !!time && toSecs(time) >= DAY_SECS;

function toContinuation([tripId, line, routeType, headsign, departureTime]: ContinuationRow): AppContinuation {
    return { trip_id: tripId, line, type: normalizeRouteType(routeType), headsign, departure_time: departureTime };
}

/**
 * Feeders and continuation for one departure; its own stop id is the platform it leaves from.
 *
 * Feeders' timestamps are already resolved per day at build time (`FeederRow`), so unlike
 * continuations this needs no day-of-week matching - a trip_id may have two rows (today's and
 * tomorrow's occurrence) if it runs both days; whichever's baked-in time is closest to this
 * departure's own scheduled time is the relevant one.
 */
export function departureConnections(
    file: LiveConnections | null,
    tripId: string | undefined,
    stopId: string | undefined,
    scheduledIso: string
): { connections?: AppDepartureFeeder[]; continues_as?: AppContinuation } {
    const trip = file && tripId ? file.trips[tripId] : undefined;
    if (!file || !trip) return {};

    const rows = stopId ? trip.in?.[stopId] : undefined;
    const scheduledMs = Date.parse(scheduledIso);

    const byLine = new Map<string, FeederRow>();
    for (const row of rows ?? []) {
        const existing = byLine.get(row[1]);
        if (!existing || Math.abs(row[3] - scheduledMs) < Math.abs(existing[3] - scheduledMs)) byLine.set(row[1], row);
    }

    const connections: AppDepartureFeeder[] = [];
    for (const [feederTripId, line, routeType, arrivalMs, minTransferS, maxWaitS] of byLine.values()) {
        connections.push({
            line,
            type: normalizeRouteType(routeType),
            trip_id: feederTripId,
            base_hold_s: Math.round((arrivalMs + minTransferS * 1000 - scheduledMs) / 1000),
            max_wait_s: maxWaitS,
        });
    }

    return {
        ...(connections.length > 0 ? { connections } : {}),
        ...(trip.continues ? { continues_as: toContinuation(trip.continues) } : {}),
    };
}

/** Sets onward connections on each stop of the trip and the continuation on its last stop. */
export function attachTripConnections(detail: AppVehicleDetail, file: LiveConnections | null, clock: LocalClock): void {
    const trip = file?.trips[detail.gtfs_trip_id];
    const features = detail.stop_times?.features;
    if (!file || !trip || !features || features.length === 0) return;

    const lastTime = features[features.length - 1]!.properties.arrival_time;
    const runsPastMidnight = isPastMidnight(lastTime) && clock.secs < toSecs(lastTime) - DAY_SECS;
    const bit = serviceDayBit(file, trip, clock.date, runsPastMidnight);
    const delay = typeof detail.delay === 'number' ? detail.delay : null;

    for (const feature of features) {
        const rows = trip.out?.[String(feature.properties.stop_sequence)];
        if (!rows || !bit) continue;
        const arrivalTime = feature.properties.arrival_time || feature.properties.departure_time;
        const connections: AppStopConnection[] = [];
        for (const [toTripId, line, routeType, headsign, departureTime, minTransferS, maxWaitS, dayFlags] of rows) {
            if (!(dayFlags & bit)) continue;
            connections.push({
                trip_id: toTripId,
                line,
                type: normalizeRouteType(routeType),
                headsign,
                departure_time: departureTime,
                delay: null,
                max_wait_s: maxWaitS,
                at_risk: isConnectionAtRisk(arrivalTime, delay, minTransferS, departureTime, maxWaitS),
            });
        }
        if (connections.length > 0) feature.properties.connections = connections;
    }

    if (trip.continues) features[features.length - 1]!.properties.continues_as = toContinuation(trip.continues);
}
