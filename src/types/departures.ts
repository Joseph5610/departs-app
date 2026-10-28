import type { AppDeparture, AppDepartureFeeder } from '@shared/api';
import type { Continuation } from './vehicles';

/** Opens a departure's trip; the departure itself seeds the trip view while its detail loads. */
export type DepartureClickHandler = (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => void;

/** A departure as the API sends it, plus what the app derives for the board. */
export interface Departure extends AppDeparture {
    delayDelta?: number;
    lastDelayUpdate?: number;
    /** Set in the app for a platform without a code: the direction it serves (`withStopPlatforms`). */
    platformDirection?: string;
    route_color?: string;
    connections?: DepartureFeeder[];
    continues_as?: Continuation;
}

/** An arriving trip a departure waits for; `hold_s`/`will_miss` are computed in the app from its live delay (`withFeederHold`). */
export interface DepartureFeeder extends AppDepartureFeeder {
    route_color?: string;
    hold_s?: number | null;
    will_miss?: boolean;
}
