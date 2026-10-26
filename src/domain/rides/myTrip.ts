import { MY_TRIP_CONFIG, RIDE_CONFIG } from '@/config/constants';
import { formatTimetableClock } from '@/domain/time';
import type { MyTrip, MyTripStatus, RideStatus, TripStart, VehicleDetail } from '@/types';
import { isBoardingOver } from '@shared/rides';
import { delayAtStop, reminderCountdown } from './boarding';
import { deriveRide, exitArrival } from './status';

/**
 * A My trip's state: `boarding` until its vehicle has left the user's stop by live position, or a little after its
 * expected departure (live delay included) at the latest, then `riding` with the ride's own status. Without a detail
 * (it failed) boarding counts down on the timetable. Null once the ride is over or expired, so the trip can be dropped.
 */
export const deriveMyTrip = (trip: MyTrip, detail: VehicleDetail | undefined, isError: boolean, now: number, timeZone: string): MyTripStatus | null => {
    // A trip planned ahead ages from its departure, not from when it was saved.
    const startedAt = tripStartMs(trip);
    if (now - startedAt > RIDE_CONFIG.MAX_AGE_MS) return null;
    const board = trip.board;
    if (board && (detail || isError)) {
        const stops = detail?.stop_times?.features ?? [];
        const stopDelay = !detail || detail.is_static_fallback ? 0 : delayAtStop(stops, board.sequence, detail.delay);
        const { expectedMs, minutes } = reminderCountdown(board.scheduledMs, stopDelay, now);
        // The clock ends boarding too: a live position can stall (a gap in the feed) and must not keep it open forever.
        const isBefore = !isBoardingOver(detail, board.sequence, expectedMs, now);
        // Decided before the ride's own phase, whose timetable clock wraps at 12 h and would end a trip saved for tonight.
        if (isBefore) {
            return {
                phase: 'boarding',
                trip,
                stopName: board.stopName,
                departureTime: formatTimetableClock(new Date(expectedMs).toISOString(), timeZone),
                minutes,
                isSoon: board.leadMin !== null && minutes <= board.leadMin,
                routeName: String(detail?.route_short_name ?? ''),
                routeColor: detail?.route_color ?? '',
                headsign: detail?.trip_headsign ?? '',
                arrivalTime: trip.toEnd ? null : exitArrival(stops, trip.exitSequence, detail?.delay)?.time ?? null,
            };
        }
    }
    const ride = deriveRide({ ...trip, startedAt }, detail, isError, now, timeZone);
    return ride ? { phase: 'riding', trip, ride } : null;
};

/** When a trip begins for its expiry: its departure from the user's stop or its first stop, else when it was saved. */
const tripStartMs = (trip: Pick<MyTrip, 'startedAt' | 'board' | 'start'>): number =>
    Math.max(trip.startedAt, trip.board?.scheduledMs ?? trip.start?.scheduledMs ?? 0);

/** Whether a trip is under way: taken aboard, or its departure is close; a trip saved for later is not. */
export const isTripUnderway = (trip: Pick<MyTrip, 'board' | 'start'>, now: number): boolean => {
    const departs = trip.board ?? trip.start;
    return !departs || now >= departs.scheduledMs - MY_TRIP_CONFIG.UNDERWAY_BEFORE_MS;
};

/** A trip's first departure, while it hasn't run yet (no live stop and its first call still ahead). */
export const tripStartOf = (calls: readonly TripStart[], currentSequence: number | null, now: number): TripStart | null => {
    const first = calls[0];
    return currentSequence === null && first && first.scheduledMs > now ? { sequence: first.sequence, scheduledMs: first.scheduledMs } : null;
};

/** Where the server starts watching: the boarding stop with its alert, else the first stop of a trip not yet running, without one. */
export const watchFrom = (trip: Pick<MyTrip, 'board' | 'start'>): { sequence: number; scheduledMs: number; leadMin: number | null } | null => {
    if (trip.board) return { sequence: trip.board.sequence, scheduledMs: trip.board.scheduledMs, leadMin: trip.board.leadMin };
    return trip.start ? { ...trip.start, leadMin: null } : null;
};

/** Whether a trip is long over by the clock alone, e.g. one in another city that nothing has looked at since. */
export const isTripExpired = (trip: Pick<MyTrip, 'startedAt' | 'board' | 'start'>, now: number): boolean => now - tripStartMs(trip) > RIDE_CONFIG.MAX_AGE_MS;

/** A saved trip keeps its `pushed` mark while what it asks the server for is unchanged; a changed one is registered anew. */
export const withPushState = <T extends Omit<MyTrip, 'startedAt'>>(next: T, previous: MyTrip | undefined): T =>
    ({ ...next, pushed: previous && tripPushKey(previous) === tripPushKey(next) ? previous.pushed : undefined });

/** The stops the user can board at with their exit picked: those before it. */
export const boardingsBefore = <T extends { sequence: number }>(choices: readonly T[], exitSequence: number | null): T[] =>
    exitSequence === null ? [...choices] : choices.filter(choice => choice.sequence < exitSequence);

/** The exits the user can pick boarding at `boardSequence` (null: already aboard): those after it. */
export const exitsAfter = <T extends { sequence: number }>(choices: readonly T[], boardSequence: number | null): T[] =>
    boardSequence === null ? [...choices] : choices.filter(choice => choice.sequence > boardSequence);

/** What a trip asks the server to push: its exit and its boarding alert; null when nothing (aboard, ridden to the end). */
export const tripPushKey = (trip: Pick<MyTrip, 'tripId' | 'exitSequence' | 'toEnd' | 'board'>): string | null => {
    const exit = trip.toEnd ? null : trip.exitSequence;
    const board = trip.board && trip.board.leadMin !== null ? `${trip.board.sequence}:${trip.board.leadMin}` : null;
    return exit === null && board === null ? null : `${trip.tripId}|${exit ?? '-'}|${board ?? '-'}`;
};

/**
 * How urgently a trip's bar belongs in front, lower first: anything due now (the stop before the exit, an arrival,
 * boarding inside its lead), then by the minutes to the trip's next moment (its departure to board, else its arrival
 * at the exit); a ride with no time yet counts as now.
 */
export const tripUrgency = (status: MyTripStatus | RideStatus): number => {
    if ('trip' in status && status.phase === 'riding') return tripUrgency(status.ride);
    if (status.phase === 'boarding') return status.isSoon ? 0 : 1 + status.minutes / 10_000;
    if (status.phase === 'next' || status.phase === 'arrived') return 0;
    return 1 + (status.minutesToArrival ?? 0) / 10_000;
};

/** A followed trip's urgency: as the user's own, placed behind their own trip at the same moment. */
export const followedUrgency = (status: MyTripStatus): number => tripUrgency(status) + 0.5;

/** Bars in front-to-back order: by `tripUrgency`, ties keeping their order. */
export const byUrgency = <T extends { urgency: number }>(items: readonly T[]): T[] => [...items].sort((a, b) => a.urgency - b.urgency);
