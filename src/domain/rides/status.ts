import { stopsLeft } from '@shared/rides';
import { RIDE_CONFIG } from '@/config/constants';
import { addSecondsToTime, formatClock, secondsOfDayIn, timeToSeconds, wrapDaySeconds } from '@/domain/time';
import { isTripEnded, liveStopSequence, secondsSinceTripEnd } from '@/domain/vehicles';
import type { Ride, RidePhase, RideStatus, StopTimeFeature, VehicleDetail } from '@/types';

/** Identity of a ride: one exit on one trip. */
export const followKey = (ride: Pick<Ride, 'tripId' | 'exitSequence'>): string => `${ride.tripId}:${ride.exitSequence}`;

/** Stops after `current` up to and including the exit. */
export const countStopsLeft = stopsLeft;

/** The stop at `exitSequence` and its expected arrival (`HH:MM`): realtime, else scheduled plus the trip's delay. */
export const exitArrival = (stops: StopTimeFeature[], exitSequence: number, delay: number | null | undefined): { stopName: string; time: string | null; rawTime: string | null } | null => {
    const p = stops.find(s => Number(s.properties.stop_sequence) === exitSequence)?.properties;
    if (!p) return null;
    const time = p.realtime_arrival_time || (p.arrival_time && typeof delay === 'number' ? addSecondsToTime(p.arrival_time, delay) : p.arrival_time) || null;
    return { stopName: p.stop_name, time: time ? formatClock(time) : null, rawTime: time };
};

/** The stops a rider can pick as their exit: those after `afterSequence`, with their expected arrival. */
export const exitChoices = (stops: StopTimeFeature[], afterSequence: number, delay: number | null | undefined): { sequence: number; stopName: string; time: string | null }[] => {
    const choices: { sequence: number; stopName: string; time: string | null }[] = [];
    for (const s of stops) {
        const sequence = Number(s.properties.stop_sequence);
        if (sequence <= afterSequence) continue;
        const arrival = exitArrival([s], sequence, delay);
        if (arrival) choices.push({ sequence, stopName: arrival.stopName, time: arrival.time });
    }
    return choices;
};

/** Seconds since a timetable time, wrapped across midnight; negative while it is still ahead. */
const secondsSince = (time: string, now: number, timeZone: string): number =>
    wrapDaySeconds(secondsOfDayIn(timeZone, now) - timeToSeconds(time));

/** Whether an arrival is too old to show: from the exit when the vehicle was seen there, else from the trip's end by the clock. */
const isArrivalStale = (stops: StopTimeFeature[], exitTime: string | null, reachedExit: boolean, delay: number | null | undefined, now: number, timeZone: string): boolean =>
    reachedExit && exitTime
        ? secondsSince(exitTime, now, timeZone) * 1000 > RIDE_CONFIG.ARRIVED_STALE_MS
        : (secondsSinceTripEnd(stops, delay, now, timeZone) ?? 0) * 1000 > RIDE_CONFIG.ARRIVED_BY_CLOCK_STALE_MS;

/** Whole minutes from `now` to a timetable time, wrapped across midnight. */
const minutesUntil = (time: string, now: number, timeZone: string): number => {
    const diff = wrapDaySeconds(timeToSeconds(time) - secondsOfDayIn(timeZone, now));
    return Math.max(0, Math.ceil(diff / 60));
};

const progressTo = (stops: StopTimeFeature[], current: number, exitSequence: number): number => {
    let first = exitSequence;
    for (const s of stops) first = Math.min(first, Number(s.properties.stop_sequence));
    const span = exitSequence - first;
    return span <= 0 ? 1 : Math.min(1, Math.max(0, (current - first) / span));
};

/** A ride's phase, stops left, arrival and progress from its trip's detail; null without a ride, once it expired or long after it arrived. */
export const deriveRide = (ride: Ride | null, detail: VehicleDetail | undefined, isError: boolean, now: number, timeZone: string): RideStatus | null => {
    if (!ride || now - ride.startedAt > RIDE_CONFIG.MAX_AGE_MS) return null;
    const stops = detail?.stop_times?.features ?? [];

    const current = liveStopSequence(detail);

    const stopsLeft = current !== null ? countStopsLeft(stops, current, ride.exitSequence) : null;

    const phase: RidePhase = !detail ? (isError ? 'unavailable' : 'loading')
        : (current !== null && current >= ride.exitSequence) || isTripEnded(stops, detail.delay, current, now, timeZone) ? 'arrived'
        : current === null ? 'waiting'
        : stopsLeft === 1 ? 'next'
        : 'riding';

    const exit = exitArrival(stops, ride.exitSequence, detail?.delay);
    if (phase === 'arrived' && isArrivalStale(stops, exit?.rawTime ?? null, current !== null && current >= ride.exitSequence, detail?.delay, now, timeZone)) return null;

    return {
        ride,
        phase,
        exitStopName: exit?.stopName ?? ride.exitStopName ?? '',
        stopsLeft,
        arrivalTime: exit?.time ?? null,
        routeName: String(detail?.route_short_name ?? ''),
        routeColor: detail?.route_color ?? '',
        headsign: detail?.trip_headsign ?? '',
        delay: typeof detail?.delay === 'number' ? detail.delay : null,
        minutesToArrival: exit?.rawTime ? minutesUntil(exit.rawTime, now, timeZone) : null,
        progress: current !== null ? progressTo(stops, current, ride.exitSequence) : null,
    };
};


/** Whether a ride has a bar yet: not while its trip is still loading. */
export const isRideShown = (status: RideStatus | null): boolean => !!status && status.phase !== 'loading';


/**
 * The alert a phase change calls for: reaching the stop before the exit, or arriving, once per ride.
 * A ride resumed at a phase (no previous phase) or a phase regained after a failed refresh does not alert.
 */
export const rideAlertFor = (previous: RidePhase | null, phase: RidePhase | null, alreadyAlerted: ReadonlySet<RidePhase>): 'next' | 'arrived' | null => {
    if (!phase || previous === null || previous === phase || alreadyAlerted.has(phase)) return null;
    return phase === 'next' || phase === 'arrived' ? phase : null;
};
