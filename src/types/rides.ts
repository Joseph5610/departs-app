/** A trip and the stop to get off at, by its sequence on that trip. */
export interface Ride {
    city: string;
    tripId: string;
    /** Null for a trip planned before a vehicle runs it; the ride then finds it by trip in the live fleet. */
    vehicleId: string | null;
    exitSequence: number;
    /** Shown while the trip's detail can't be loaded. */
    exitStopName?: string;
    startedAt: number;
    /** The server pushes this ride's alerts, so the app shows no system notification of its own. */
    pushed?: boolean;
}

/** Where the user boards their trip, and how early the alert before it leaves comes (null: no alert). */
export interface TripBoarding {
    sequence: number;
    /** The board id the trip was taken from, so the sheet reopens for that stop. */
    stopId: string | null;
    stopName: string;
    /** Timetable departure from the stop, epoch ms. */
    scheduledMs: number;
    leadMin: number | null;
    /** The app already alerted this boarding itself, so a reload or remount doesn't alert again. */
    alerted?: boolean;
}

/**
 * A trip the user takes: from a stop (`board`) and/or to an exit. Without a picked exit (`toEnd`) it is ridden to its
 * last stop, which `exitSequence` then names, and that end gets no alert. At least one of `board` and an exit is set.
 */
/** A trip's first call and its timetable departure, epoch ms. */
export interface TripStart {
    sequence: number;
    scheduledMs: number;
}

export interface MyTrip extends Ride {
    board: TripBoarding | null;
    /** Without a boarding stop, the trip's first departure when it was saved before running: it ages and is watched from then. */
    start?: TripStart | null;
    toEnd: boolean;
    /**
     * Names the trip's push registration on the server (new on every save that changes what is pushed), so removing an
     * older one can't drop a newer one. `pushed` says the server took this one. Null for a trip from before My trip.
     */
    revision?: number | null;
}

/** The trip the My trip sheet is open for, and the stop it was opened at (a board id or request id). */
export interface MyTripTarget {
    city: string;
    tripId: string;
    vehicleId: string | null;
    /** Null from the map or a trip: no boarding stop given, so the user may already be aboard. */
    stopId: string | null;
    /** The section the sheet opens on. */
    section?: 'board' | 'exit';
}

/** A My trip before its vehicle reaches the user's stop: the countdown to boarding. */
export interface BoardingStatus {
    phase: 'boarding';
    trip: MyTrip;
    stopName: string;
    departureTime: string;
    minutes: number;
    /** Inside the alert's lead time. */
    isSoon: boolean;
    routeName: string;
    routeColor: string;
    headsign: string;
    /** The exit's expected arrival, for sharing the whole trip. */
    arrivalTime: string | null;
}

/** A My trip's state: boarding, or under way (the ride's own status). */
export type MyTripStatus = BoardingStatus | { phase: 'riding'; trip: MyTrip; ride: RideStatus };

/** `own`: the user's ride; `followed`: someone else's ride opened from a shared link. */
export type RideKind = 'own' | 'followed';

/** `loading`: no detail yet; `unavailable`: the detail failed to load; `waiting`: the trip has not started; `next`: the rider's stop is the next one. */
export type RidePhase = 'loading' | 'unavailable' | 'waiting' | 'riding' | 'next' | 'arrived';

export interface RideStatus {
    ride: Ride;
    phase: RidePhase;
    exitStopName: string;
    /** Stops still to reach, the rider's own included; null before the trip starts. */
    stopsLeft: number | null;
    /** Expected arrival at the rider's stop, `HH:MM`. */
    arrivalTime: string | null;
    routeName: string;
    routeColor: string;
    headsign: string;
    /** The trip's live delay in seconds; null when unknown. */
    delay: number | null;
    /** Whole minutes until the expected arrival at the exit; null when unknown. */
    minutesToArrival: number | null;
    /** How far the vehicle is from the trip's first stop to the exit, 0–1; null before it starts. */
    progress: number | null;
}
