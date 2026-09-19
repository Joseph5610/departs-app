/** `[feeder_trip_id, feeder_route_id, feeder_arrival_ms, min_transfer_s, max_wait_s]` */
export type GtfsFeederTuple = [string, string, number, number, number];

import type { GtfsContinuation } from '../../core/continuations';

export interface GtfsDepartureExtras {
    feeders?: GtfsFeederTuple[];
    continues?: GtfsContinuation;
}

/** `[trip_id, route_id, headsign, timestamp_ms, wheelchair_accessible?, is_request_stop?, extras?]` */
export type GtfsDepartureTuple =
    | [string, string, string, number]
    | [string, string, string, number, number]
    | [string, string, string, number, number, number]
    | [string, string, string, number, number, number, GtfsDepartureExtras];
