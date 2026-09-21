import { GOLEMIO_CONFIG } from "./config";
import { UPSTREAM_TTL_S } from "../../_core/config";
import { CacheManager, MEMORY_CACHE_TTL } from "../../_core/feed/CacheManager";
import { appClient } from '../../_core/ApiClient';

/** `[to_trip_id, line, route_type, headsign, departure_time, min_transfer_s, max_wait_s, dayFlags]` */
export type OnwardRow = [string, string, string, string, string, number, number, number];
/** `[from_trip_id, line, route_type, arrival_time, min_transfer_s, max_wait_s, dayFlags]` */
export type FeederRow = [string, string, string, string, number, number, number];
/** `[trip_id, line, route_type, headsign, departure_time]` */
export type ContinuationRow = [string, string, string, string, string];

export interface TripConnections {
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
