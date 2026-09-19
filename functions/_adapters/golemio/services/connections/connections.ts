import type { AppContinuation, AppDepartureFeeder, AppStopConnection, AppVehicleDetail } from "../../../../_core/types";
import { GOLEMIO_CONFIG } from "../../core/config";
import { UPSTREAM_TTL_S } from "../../../../_core/config";
import { CacheManager, MEMORY_CACHE_TTL } from "../../../../_core/utils/CacheManager";
import { appClient } from '../../../../_core/ApiClient';
import { getPreviousDateString, toSecs } from "../../../../_core/utils/time";
import { isConnectionAtRisk } from "../../../../_core/utils/connections";
import { normalizeRouteType } from "../../../../_core/utils/routeTypes";
import { getVehicleColor } from "../vehicles/colors";

/** `[to_trip_id, line, route_type, headsign, departure_time, min_transfer_s, max_wait_s, dayFlags]` */
type OnwardRow = [string, string, string, string, string, number, number, number];
/** `[from_trip_id, line, route_type, arrival_time, min_transfer_s, max_wait_s, dayFlags]` */
type FeederRow = [string, string, string, string, number, number, number];
/** `[trip_id, line, route_type, headsign, departure_time]` */
type ContinuationRow = [string, string, string, string, string];

interface TripConnections {
    d: number;
    /** By `stop_sequence`: Golemio's trip detail keeps GTFS sequences but omits stop ids. */
    out?: Record<string, OnwardRow[]>;
    in?: Record<string, FeederRow[]>;
    continues?: ContinuationRow;
}

/** `prague/connections.json`, built by departs-data from the PID GTFS. */
export interface LiveConnections {
    days: string[];
    trips: Record<string, TripConnections>;
}

const DAY_SECS = 86_400;

/**
 * Fetches the Prague connections file once per isolate. Null when unavailable, which leaves
 * departures and trip detail exactly as Golemio returns them.
 */
export async function getLiveConnections(): Promise<LiveConnections | null> {
    return CacheManager.getOrFetch('prague_connections', MEMORY_CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const res = await appClient.fetch(GOLEMIO_CONFIG.CONNECTIONS_DATA_URL, {
                cf: { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA }
            });
            if (!res.ok) {
                console.error("Failed to fetch Prague connections:", res.status);
                return null;
            }
            return JSON.parse(await res.text()) as LiveConnections;
        } catch (e) {
            console.error("Failed to load Prague connections:", e);
            return null;
        }
    }, (data) => !data);
}

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
    const type = normalizeRouteType(routeType);
    return { trip_id: tripId, line, route_color: getVehicleColor(type, line), type, headsign, departure_time: departureTime };
}

/** Feeders and continuation for one departure; its own stop id is the platform it leaves from. */
export function departureConnections(
    file: LiveConnections | null,
    tripId: string | undefined,
    stopId: string | undefined,
    scheduledIso: string
): { connections?: AppDepartureFeeder[]; continues_as?: AppContinuation } {
    const trip = file && tripId ? file.trips[tripId] : undefined;
    if (!file || !trip) return {};

    const rows = stopId ? trip.in?.[stopId] : undefined;
    // Golemio timestamps carry the local offset, so the first ten characters are the local date.
    const localDate = scheduledIso.slice(0, 10).replace(/-/g, '');
    const bit = rows ? serviceDayBit(file, trip, localDate, rows.some(r => isPastMidnight(r[3]))) : 0;

    const connections: AppDepartureFeeder[] = [];
    const seenLines = new Set<string>();
    for (const [, line, routeType, , , maxWaitS, dayFlags] of rows ?? []) {
        if (!(dayFlags & bit) || seenLines.has(line)) continue;
        seenLines.add(line);
        const type = normalizeRouteType(routeType);
        connections.push({ line, route_color: getVehicleColor(type, line), type, max_wait_s: maxWaitS, hold_s: null, will_miss: false });
    }

    return {
        ...(connections.length > 0 ? { connections } : {}),
        ...(trip.continues ? { continues_as: toContinuation(trip.continues) } : {}),
    };
}

/** Sets onward connections on each stop of the trip and the continuation on its last stop. */
export function attachTripConnections(detail: AppVehicleDetail, file: LiveConnections | null, localDate: string, nowSecs: number): void {
    const trip = file?.trips[detail.gtfs_trip_id];
    const features = detail.stop_times?.features;
    if (!file || !trip || !features || features.length === 0) return;

    const lastTime = features[features.length - 1]!.properties.arrival_time;
    const runsPastMidnight = isPastMidnight(lastTime) && nowSecs < toSecs(lastTime) - DAY_SECS;
    const bit = serviceDayBit(file, trip, localDate, runsPastMidnight);
    const delay = typeof detail.delay === 'number' ? detail.delay : null;

    for (const feature of features) {
        const rows = trip.out?.[String(feature.properties.stop_sequence)];
        if (!rows || !bit) continue;
        const arrivalTime = feature.properties.arrival_time || feature.properties.departure_time;
        const connections: AppStopConnection[] = [];
        for (const [toTripId, line, routeType, headsign, departureTime, minTransferS, maxWaitS, dayFlags] of rows) {
            if (!(dayFlags & bit)) continue;
            const type = normalizeRouteType(routeType);
            connections.push({
                trip_id: toTripId,
                line,
                route_color: getVehicleColor(type, line),
                type,
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
