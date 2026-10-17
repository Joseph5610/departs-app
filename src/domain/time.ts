const DAY_S = 86_400;
const HALF_DAY_S = DAY_S / 2;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Seconds since midnight of an `HH:MM[:SS]` time; GTFS times past midnight run beyond 24 hours. */
export const timeToSeconds = (time: string): number => {
    const [h, m, s] = time.split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

/** An `HH:MM[:SS]` time for display, with GTFS's 24+ hours wrapped to the clock. */
export const formatClock = (time: string | null | undefined, withSeconds = false): string => {
    if (!time) return '';
    const value = time.slice(0, withSeconds ? 8 : 5);
    const hours = Number(value.slice(0, 2));
    return hours >= 24 ? `${pad2(hours - 24)}${value.slice(2)}` : value;
};

/** `HH:MM` of a live time rounded to the nearest minute, so a delay past the half-minute badge tolerance moves the shown minute. */
export const formatExpectedClock = (time: string | null | undefined): string =>
    time ? formatClock(addSecondsToTime(time, 30)) : '';

const timeOfDayFormats = new Map<string, Intl.DateTimeFormat>();

/** Whether the local hour at `ms` falls in [from, to); a range with `from` after `to` wraps past midnight. */
export const isWithinLocalHours = (ms: number, timeZone: string, [from, to]: readonly [number, number]): boolean => {
    const hour = Math.floor(secondsOfDayIn(timeZone, ms) / 3600);
    return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
};

/** Seconds since midnight of `ms` in `timeZone`, the zone timetables are written in. */
export const secondsOfDayIn = (timeZone: string, ms: number): number => {
    let format = timeOfDayFormats.get(timeZone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
        timeOfDayFormats.set(timeZone, format);
    }
    return timeToSeconds(format.format(ms));
};

const weekdayFormats = new Map<string, Intl.DateTimeFormat>();
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Day of the week of `ms` in `timeZone`, 0 = Monday … 6 = Sunday. */
export const weekdayIn = (timeZone: string, ms: number): number => {
    let format = weekdayFormats.get(timeZone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
        weekdayFormats.set(timeZone, format);
    }
    return WEEKDAYS.indexOf(format.format(ms));
};

/** 1 January 2024 was a Monday, so adding 0–6 days yields Monday–Sunday. */
const REFERENCE_MONDAY_MS = Date.UTC(2024, 0, 1);

/** Short weekday names in `locale`, Monday first, capitalized as on printed timetables. */
export const weekdayShortNames = (locale: string | undefined): string[] => {
    const format = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, i) => {
        const name = format.format(REFERENCE_MONDAY_MS + i * DAY_S * 1000);
        return name.charAt(0).toUpperCase() + name.slice(1);
    });
};

/**
 * A difference between two times of day wrapped into ±12 h, so times either side of midnight compare as close:
 * `00:20` is 50 minutes after `23:30`, and a service-day `24:30` is 20 minutes after `00:10`.
 */
export const wrapDaySeconds = (diff: number): number => {
    if (diff < -HALF_DAY_S) return diff + DAY_S;
    if (diff > HALF_DAY_S) return diff - DAY_S;
    return diff;
};

/** How late `realtimeTime` is against `scheduledTime`, in seconds. */
export const calculateTimeDifferenceSecs = (realtimeTime: string, scheduledTime: string): number =>
    wrapDaySeconds(timeToSeconds(realtimeTime) - timeToSeconds(scheduledTime));

/** An `HH:MM:SS` time moved by `seconds`, wrapped onto the clock across midnight. */
export const addSecondsToTime = (timeStr: string, seconds: number): string => {
    let total = timeToSeconds(timeStr) + seconds;
    if (total < 0) total += DAY_S;
    if (total >= DAY_S) total -= DAY_S;
    return `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(Math.floor(total % 60))}`;
};

const clockFormats = new Map<string, Intl.DateTimeFormat>();

/** `HH:MM` of an instant in the city's own zone, so the board agrees with the timetable times of its trips. */
export const formatTimetableClock = (iso: string, timeZone: string): string => {
    let format = clockFormats.get(timeZone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        clockFormats.set(timeZone, format);
    }
    return format.format(Date.parse(iso));
};

/** A calendar date (`2026-10-08`) in the locale's long form, e.g. (cs) "8. října 2026". */
export const formatDate = (isoDate: string, locale: string | undefined): string =>
    new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Formats a timestamp (ISO string or ms number) into a locale-aware date+time string.
 * Example (cs): "12. 7. 2026, 00:30". A value that is not a timestamp is returned as given.
 */
export const formatDateTime = (value: string | number, locale: string | undefined): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(locale, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });
};

/** Whole minutes from `nowMs` until `iso`, rounded down; zero or less once it is due. */
export const minutesUntil = (iso: string, nowMs: number): number => Math.floor((Date.parse(iso) - nowMs) / 60_000);

/** How a glanceable countdown reads: due now, in whole minutes, or (from `minutesLimit` away) as its clock time. */
export type MinutesCountdown = { kind: 'now' } | { kind: 'minutes'; minutes: number } | { kind: 'clock' };

export const minutesCountdown = (iso: string, nowMs: number, minutesLimit: number): MinutesCountdown => {
    const minutes = minutesUntil(iso, nowMs);
    if (minutes <= 0) return { kind: 'now' };
    return minutes < minutesLimit ? { kind: 'minutes', minutes } : { kind: 'clock' };
};
