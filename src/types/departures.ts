import type { Continuation, RouteType } from './vehicles';

/** Opens a departure's trip; the departure itself seeds the trip view while its detail loads. */
export type DepartureClickHandler = (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => void;

export interface Departure {
    timestamp: string;
    scheduled: string;
    delay: number | null;
    delayDelta?: number;
    lastDelayUpdate?: number;
    line: string;
    type: RouteType;
    directionId: string;
    headsign: string;
    isCanceled: boolean;
    tripId?: string;
    vehicleId?: string;
    platform?: string;
    /** Set in the app for a platform without a code: the direction it serves (`withStopPlatforms`). */
    platformDirection?: string;
    route_color?: string;
    is_wheelchair_accessible?: boolean | null;
    is_air_conditioned?: boolean | null;
    stopId?: string;
    /** The platform a departure leaves from when `stopId` is the station asked for (GTFS cities). */
    platformStopId?: string;
    is_request_stop?: boolean;
    connections?: DepartureFeeder[];
    continues_as?: Continuation;
}

/**
 * An arriving trip that a departure is scheduled to wait for. `trip_id`/`base_hold_s` come from
 * the backend; `hold_s`/`will_miss` are computed client-side from the feeder's live delay (see
 * `withFeederHold` in `domain/departures/enrich.ts`) - not present until that enrichment step has run.
 */
export interface DepartureFeeder {
    line: string;
    route_color?: string;
    type: RouteType;
    trip_id: string;
    base_hold_s: number;
    max_wait_s: number;
    hold_s: number | null;
    will_miss: boolean;
}
