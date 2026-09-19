/** `[to_trip_id, to_route_id, headsign, departure_time, min_transfer_s, max_wait_s]`; all calendar variants. */
import type { GtfsContinuation } from '../../core/continuations';

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
