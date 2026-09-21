import type { GtfsContinuation } from './continuations';

/** `[to_trip_id, to_route_id, headsign, departure_time, min_transfer_s, max_wait_s]`; all calendar variants. */
export type GtfsTripConnection = [string, string, string, string, number, number];

export interface Station {
    id: string;
    name: string;
    sequence: number;
    arrival_time: string;
    departure_time: string;
    coordinates: [number, number];
    is_wheelchair_accessible: null;
    zone_id: string | null;
    is_request_stop?: boolean;
    connections?: GtfsTripConnection[];
    continues_as?: GtfsContinuation;
}

/** `[feeder_trip_id, feeder_route_id, feeder_arrival_ms, min_transfer_s, max_wait_s]` */
export type GtfsFeederTuple = [string, string, number, number, number];

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
