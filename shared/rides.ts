/**
 * Trip rules the app and the server's ride watch both apply, so the countdown on screen and the pushed alerts agree.
 * Plain TypeScript importing only its own files: both builds compile it.
 */
import { timeToSeconds, wrapDaySeconds } from './time';

export const TRIP_RULES = {
    /** Without a live position, the rider counts as boarded this long after the expected departure from their stop. */
    BOARD_GRACE_MS: 2 * 60_000,
    /** A boarding stop's timetable time is read as at most this long behind now, else as up to `TIMETABLE_AHEAD_MS` ahead. */
    TIMETABLE_BEHIND_MS: 3 * 3600_000,
    /** How far ahead a boarding stop may be: together with `TIMETABLE_BEHIND_MS`, one day. */
    TIMETABLE_AHEAD_MS: 21 * 3600_000,
};

/** The push protocol between the app and the server's ride watch. */
export const RIDE_PROTOCOL = {
    /** Notification tags, per trip (`tripNotificationTag`): `arrived` replaces `next`, `cancelled` replaces `soon`, trips never each other. */
    EXIT_TAG: 'ride-own',
    BOARD_TAG: 'departure-reminder',
    /** Placeholder in a boarding alert's texts the server puts the minutes left into. */
    MINUTES_TOKEN: '{min}',
    /** Longest lead (minutes before the departure) a boarding alert may ask for: the app's fixed leads or the user's walk. */
    MAX_LEAD_MIN: 60,
};

/** A trip's notification tag, so the app's own alert and a push of the same kind replace each other. */
export const tripNotificationTag = (base: string, tripId: string): string => `${base}:${tripId}`;

/** A trip's live position as the vehicle-detail API reports it. */
export interface TripPosition {
    is_static_fallback?: boolean;
    state_position?: string | null;
    last_stop_sequence?: number | null;
}

/** A trip's call as the vehicle-detail API reports it. */
export interface TripCall {
    properties: { stop_sequence: number; departure_time?: string | null; realtime_departure_time?: string | null };
}

const NOT_STARTED = new Set(['before_track', 'before_track_delayed']);
/** The stop the live vehicle last passed; null for a timetable-only trip or one that hasn't started. */
export const liveStopSequence = (detail: TripPosition | null | undefined): number | null => {
    if (!detail || detail.is_static_fallback || NOT_STARTED.has(detail.state_position ?? '')) return null;
    const seq = detail.last_stop_sequence;
    return seq === null || seq === undefined ? null : Number(seq);
};

/** Whether the vehicle has left the stop at `sequence`: it passed it, or reported it and isn't standing there any more. Null without a live position. */
export const hasLeftStop = (detail: TripPosition | null | undefined, sequence: number): boolean | null => {
    const current = liveStopSequence(detail);
    if (current === null) return null;
    return current > sequence || (current === sequence && detail?.state_position !== 'at_stop');
};

/** Whether boarding at `sequence` is over: the vehicle left the stop, or the clock passed its expected departure plus the grace (a live position can stall). */
export const isBoardingOver = (detail: TripPosition | null | undefined, sequence: number, expectedMs: number, now: number): boolean =>
    hasLeftStop(detail, sequence) === true || now >= expectedMs + TRIP_RULES.BOARD_GRACE_MS;

/** Stops after `current` up to and including the exit. */
export const stopsLeft = (stops: readonly TripCall[], current: number, exitSequence: number): number => {
    let count = 0;
    for (const s of stops) {
        const seq = Number(s.properties.stop_sequence);
        if (seq > current && seq <= exitSequence) count++;
    }
    return count;
};

/** Seconds the trip runs late at the stop at `sequence`: its own realtime departure, else the trip's delay; null when unknown. */
export const delayAtStop = (stops: readonly TripCall[], sequence: number, tripDelaySecs: number | null | undefined): number | null => {
    const p = stops.find(s => Number(s.properties.stop_sequence) === sequence)?.properties;
    if (p?.realtime_departure_time && p.departure_time) return wrapDaySeconds(timeToSeconds(p.realtime_departure_time) - timeToSeconds(p.departure_time));
    return typeof tripDelaySecs === 'number' ? tripDelaySecs : null;
};
