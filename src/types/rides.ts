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
}

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
