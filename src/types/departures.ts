import type { Continuation, RouteType } from './vehicles';

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
    route_color?: string;
    is_wheelchair_accessible?: boolean | null;
    is_air_conditioned?: boolean | null;
    headsign_metro_lines?: Array<{ name: string; route_color: string }>;
    stopId?: string;
    is_request_stop?: boolean;
    connections?: DepartureFeeder[];
    continues_as?: Continuation;
}

/** An arriving trip that a departure is scheduled to wait for. */
export interface DepartureFeeder {
    line: string;
    route_color?: string;
    type: RouteType;
    max_wait_s: number;
    hold_s: number | null;
    will_miss: boolean;
}
