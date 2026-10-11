import { getDelayStatus, type DelayStatus } from '@/domain/delay';
import { formatTimetableClock } from '@/domain/time';
import type { Departure, DepartureFeeder } from '@/types';
import { distinctLines, summarizeFeeders } from './lines';

/** What a departure's live data says: cancelled, timetable only (no realtime), or how its delay reads. */
export type LiveStatus = DelayStatus | 'timetable' | 'canceled';

export const liveStatus = (dep: Pick<Departure, 'isCanceled' | 'delay'>): LiveStatus => {
    if (dep.isCanceled) return 'canceled';
    if (dep.delay === null || dep.delay === undefined) return 'timetable';
    return getDelayStatus(dep.delay);
};

/** What a departure says about its feeders: a missed connection, a live hold, or the lines it waits for. */
/** A feeder line as its badge shows it. */
export interface NoticeLine {
    name: string;
    color: string;
}

export type FeederNotice =
    | { kind: 'wontWait'; lines: NoticeLine[] }
    | { kind: 'held'; lines: NoticeLine[]; minutes: number }
    | { kind: 'waits'; lines: NoticeLine[] };

export const feederNotice = (feeders: DepartureFeeder[] | undefined): FeederNotice | null => {
    if (!feeders?.length) return null;
    const colors = new Map(distinctLines(feeders));
    const line = (name: string): NoticeLine => ({ name, color: colors.get(name) ?? '' });
    const { missed, held, heldMinutes } = summarizeFeeders(feeders);
    if (missed.length > 0) return { kind: 'wontWait', lines: [...new Set(missed)].map(line) };
    if (held) return { kind: 'held', lines: [line(held.line)], minutes: heldMinutes };
    const names = [...colors.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { kind: 'waits', lines: names.map(line) };
};

/** A departure's timetable time and, when live data moves it to another minute, the time it is expected instead. */
export const departureClock = (
    dep: Pick<Departure, 'scheduled' | 'timestamp' | 'isCanceled' | 'delay'>,
    timeZone: string,
): { scheduled: string; expected: string | null } => {
    const scheduled = formatTimetableClock(dep.scheduled, timeZone);
    if (dep.isCanceled || dep.delay === null || dep.delay === undefined) return { scheduled, expected: null };
    const expected = formatTimetableClock(dep.timestamp, timeZone);
    return { scheduled, expected: expected === scheduled ? null : expected };
};

/** A stable React key for a departure row, unique per trip and scheduled time. */
export const departureKey = (dep: Pick<Departure, 'tripId' | 'scheduled'>): string =>
    dep.tripId ? `${dep.tripId}-${dep.scheduled}` : dep.scheduled;

/** Where a departure boards when riders choose between places: a metro track, or a train platform. */
export const boardingPlace = (dep: Pick<Departure, 'type' | 'platform'>): { track: string | null; platform: string | null } => ({
    track: dep.type === 'metro' && dep.platform ? dep.platform : null,
    platform: dep.type === 'train' && dep.platform ? dep.platform : null,
});
