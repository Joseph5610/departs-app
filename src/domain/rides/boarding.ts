import { TRIP_RULES } from '@shared/rides';
import { RIDE_PROTOCOL } from '@shared/rides';
import { MY_TRIP_CONFIG, WALKING } from '@/config/constants';
import type { StopDistanceInfo } from '@/domain/stops';
import { addSecondsToTime, calculateTimeDifferenceSecs, DAY_S, formatClock, secondsOfDayIn, timeToSeconds, utcOffsetSeconds } from '@/domain/time';
import type { StopTimeFeature, TripBoarding } from '@/types';

/** The epoch ms of a timetable time, read in the city's zone: from `TIMETABLE_BEHIND_MS` behind now to a day less that ahead. */
export const timetableInstantMs = (time: string, now: number, timeZone: string): number => {
    const nowS = Math.floor(now / 1000);
    const behindS = TRIP_RULES.TIMETABLE_BEHIND_MS / 1000;
    const aheadS = (((timeToSeconds(time) - secondsOfDayIn(timeZone, now) + behindS) % DAY_S) + DAY_S) % DAY_S - behindS;
    const sameOffset = (nowS + aheadS) * 1000;
    // Across a DST switch the clock jumps an hour against elapsed time.
    return sameOffset - (utcOffsetSeconds(timeZone, sameOffset) - utcOffsetSeconds(timeZone, now)) * 1000;
};

/** Whether a departure expected at `scheduledMs` plus the delay is still more than the lead time (and a minute) away. */
export const isLeadPossible = (scheduledMs: number, delaySecs: number | null | undefined, leadMin: number, now: number): boolean =>
    scheduledMs + (delaySecs ?? 0) * 1000 - now > (leadMin + 1) * 60_000;

/** The lead options still possible before a departure. */
export const fittingLeads = (scheduledMs: number, delaySecs: number | null | undefined, now: number): number[] =>
    MY_TRIP_CONFIG.LEAD_MINUTES.filter(leadMin => isLeadPossible(scheduledMs, delaySecs, leadMin, now));

/** A lead that leaves time to walk to the stop and catch the vehicle; null at the stop or without a location. */
export const walkLeadMinutes = (distance: StopDistanceInfo | null): number | null =>
    !distance || distance.isAtStop ? null : Math.min(RIDE_PROTOCOL.MAX_LEAD_MIN, distance.time + Math.ceil(WALKING.CATCH_BUFFER_S / 60));

/** The lead preselected at a stop: the user's walk there, else the default, else the longest that still fits. */
export const defaultLead = (leads: readonly number[], walkLead: number | null): number | null =>
    walkLead ?? (leads.includes(MY_TRIP_CONFIG.DEFAULT_LEAD_MIN) ? MY_TRIP_CONFIG.DEFAULT_LEAD_MIN : leads.at(-1) ?? null);

/** When a reminded departure is expected and the whole minutes left until it. */
export const reminderCountdown = (scheduledMs: number, delaySecs: number | null | undefined, now: number): { expectedMs: number; minutes: number } => {
    const expectedMs = scheduledMs + (delaySecs ?? 0) * 1000;
    return { expectedMs, minutes: Math.max(0, Math.round((expectedMs - now) / 60_000)) };
};

/** The call where the user boards: the first stop still ahead of the vehicle among the board's `stopIds`. */
export const boardingSequence = (stops: StopTimeFeature[], stopIds: ReadonlySet<string>, currentSequence: number | null): number | null => {
    for (const stop of stops) {
        const sequence = Number(stop.properties.stop_sequence);
        if (currentSequence !== null && sequence <= currentSequence) continue;
        if (stopIds.has(stop.properties.stop_id)) return sequence;
    }
    return null;
};

const coordinatesOf = (stop: StopTimeFeature): [number, number] | null => {
    const point = stop.geometry?.coordinates;
    return point && typeof point[0] === 'number' && typeof point[1] === 'number' ? [point[0], point[1]] : null;
};

/** A stop ahead on the trip that a departure reminder can be set at, with the leads still possible there. */
export interface BoardingChoice {
    sequence: number;
    stopId: string;
    stopName: string;
    /** Timetable departure, epoch ms. */
    scheduledMs: number;
    /** How late the trip runs at this stop, seconds; null when unknown. */
    delaySecs: number | null;
    /** Expected departure as a clock time. */
    time: string | null;
    coordinates: [number, number] | null;
    leads: number[];
}

/** The stops ahead of the vehicle the user can board at, each with the alert leads still possible there (maybe none). */
export const boardingChoices = (
    stops: StopTimeFeature[], currentSequence: number | null, delaySecs: number | null | undefined, now: number, timeZone: string,
): BoardingChoice[] => {
    const choices: BoardingChoice[] = [];
    for (const stop of stops) {
        const p = stop.properties;
        const sequence = Number(p.stop_sequence);
        if (currentSequence !== null && sequence <= currentSequence) continue;
        const scheduled = p.departure_time || p.arrival_time;
        if (!scheduled) continue;
        const scheduledMs = timetableInstantMs(scheduled, now, timeZone);
        const stopDelay = p.realtime_departure_time ? calculateTimeDifferenceSecs(p.realtime_departure_time, scheduled) : delaySecs;
        const leads = fittingLeads(scheduledMs, stopDelay, now);
        choices.push({ sequence, stopId: p.stop_id, stopName: p.stop_name, scheduledMs, delaySecs: stopDelay ?? null, time: expectedDepartureClock(p, delaySecs), coordinates: coordinatesOf(stop), leads });
    }
    return choices;
};


/** The trip's call at `sequence` as a boarding stop without an alert, e.g. from a shared link; null when the trip has no such stop. */
export const boardingAt = (stops: StopTimeFeature[], sequence: number, now: number, timeZone: string): TripBoarding | null => {
    const stop = stops.find(s => Number(s.properties.stop_sequence) === sequence)?.properties;
    const time = stop?.departure_time || stop?.arrival_time;
    if (!stop || !time) return null;
    return { sequence, stopId: stop.stop_id, stopName: stop.stop_name, scheduledMs: timetableInstantMs(time, now, timeZone), leadMin: null };
};

/** A call's expected departure as a clock time: its realtime one, else the timetable plus the trip's delay. */
const expectedDepartureClock = (p: StopTimeFeature['properties'], delaySecs: number | null | undefined): string | null => {
    const scheduled = p.departure_time || p.arrival_time;
    if (!scheduled) return null;
    const expected = p.realtime_departure_time || (typeof delaySecs === 'number' ? addSecondsToTime(scheduled, delaySecs) : scheduled);
    return expected ? formatClock(expected) : null;
};

/** The expected departure from the stop at `sequence` as a clock time; null when the trip has no such stop. */
export const stopDepartureClock = (stops: StopTimeFeature[], sequence: number, delaySecs: number | null | undefined): string | null => {
    const p = stops.find(s => Number(s.properties.stop_sequence) === sequence)?.properties;
    return p ? expectedDepartureClock(p, delaySecs) : null;
};

export { delayAtStop, hasLeftStop } from '@shared/rides';
