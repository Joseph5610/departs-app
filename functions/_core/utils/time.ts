export const DAY_MS = 86_400_000;
export const DAY_SECS = 86_400;
export const DAY_MINS = 1440;

const HOUR_MS = 3_600_000;
const HALF_DAY_SECS = 43_200;

/** Formats an instant as `HH:mm` in the given IANA timezone. */
export function formatTime(date: Date, timezone: string): string {
    const local = new Date(date.getTime() + zoneOffsetMs(timezone, date.getTime()));
    return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Zones on Central European Time with EU summer time. Their offset is computed rather than read from
 * `Intl`, whose first use loads the timezone database at a CPU cost a cold Worker cannot afford.
 */
const EU_CENTRAL_ZONES = new Set(['Europe/Prague', 'Europe/Bratislava']);

/** 01:00 UTC on the last Sunday of `month` (0-based), when EU summer time starts or ends. */
function euTransitionMs(year: number, month: number): number {
    const lastDay = Date.UTC(year, month + 1, 0, 1);
    return lastDay - new Date(lastDay).getUTCDay() * DAY_MS;
}

function euCentralOffsetMs(atMs: number): number {
    const year = new Date(atMs).getUTCFullYear();
    const isSummer = atMs >= euTransitionMs(year, 2) && atMs < euTransitionMs(year, 9);
    return (isSummer ? 2 : 1) * HOUR_MS;
}

/** Local wall-clock from a cached UTC offset, rather than formatting on every call. */
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetCache = new Map<string, { hourBucket: number; offsetMs: number }>();

function zoneOffsetMs(timezone: string, atMs: number): number {
    if (EU_CENTRAL_ZONES.has(timezone)) return euCentralOffsetMs(atMs);

    // Keyed on the UTC hour, not a rolling window — a rolling one is bounded only in the future, so an
    // earlier instant would reuse a later one's offset. DST shifts land on UTC hour boundaries.
    const hourBucket = Math.floor(atMs / HOUR_MS);
    const cached = offsetCache.get(timezone);
    if (cached && cached.hourBucket === hourBucket) return cached.offsetMs;

    let formatter = offsetFormatters.get(timezone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' });
        offsetFormatters.set(timezone, formatter);
    }

    const name = formatter.formatToParts(new Date(atMs)).find(p => p.type === 'timeZoneName')?.value ?? '';
    const parsed = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
    const offsetMs = parsed
        ? (parsed[1] === '-' ? -1 : 1) * (Number(parsed[2]) * HOUR_MS + Number(parsed[3]) * 60_000)
        : 0;

    offsetCache.set(timezone, { hourBucket, offsetMs });
    return offsetMs;
}

/** Formats the UTC calendar fields of `date` as YYYYMMDD. */
const formatYmd = (date: Date): string =>
    `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;

/** A city's local calendar day and time of day at one instant. */
export interface LocalClock {
    /** YYYYMMDD */
    date: string;
    /** YYYYMMDD of the day before `date`. */
    previousDate: string;
    /** Whole seconds since local midnight. */
    secs: number;
    /** `secs` in minutes, fractional. */
    mins: number;
}

/**
 * The local date and time of day in `timezone` at `atMs` (default now). The one place the backend
 * turns an instant into local time: GTFS timetables and service days are defined in local time.
 */
export function getLocalClock(timezone: string, atMs: number = Date.now()): LocalClock {
    // Shifting by the offset makes the UTC calendar fields read as the zone's local ones.
    const local = atMs + zoneOffsetMs(timezone, atMs);
    const date = formatYmd(new Date(local));
    const secs = Math.floor((((local % DAY_MS) + DAY_MS) % DAY_MS) / 1000);
    return { date, previousDate: getPreviousDateString(date), secs, mins: secs / 60 };
}

/**
 * Wraps a difference between two times of day into [-12h, +12h], so times either side of
 * midnight compare as close together rather than a day apart.
 */
export const wrapDaySeconds = (diffSecs: number): number => {
    if (diffSecs < -HALF_DAY_SECS) return diffSecs + DAY_SECS;
    if (diffSecs > HALF_DAY_SECS) return diffSecs - DAY_SECS;
    return diffSecs;
};

/** `HH:MM:SS` or `HH:MM` to seconds; GTFS hours past 24 are kept. */
export const toSecs = (t: string): number => {
    const [h, m, s] = t.split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

/** Wraps a GTFS time past midnight (`25:10:00`) onto the clock (`01:10:00`). */
export function toClockTime(timeStr: string | undefined | null): string {
    if (!timeStr) return '';
    const parts = String(timeStr).split(':');
    if (parts.length < 2) return String(timeStr);
    parts[0] = String(parseInt(parts[0], 10) % 24).padStart(2, '0');
    return parts.join(':');
}

/**
 * Adds a delay in seconds to an `HH:MM:SS` string, wrapping around midnight.
 */
export const addSecondsToTime = (timeStr: string | undefined | null, delaySecs: number): string | undefined => {
    if (!timeStr) return undefined;
    let secs = toSecs(String(timeStr)) + delaySecs;
    if (secs < 0) secs += DAY_SECS;
    const h = Math.floor(secs / 3600) % 24;
    const m = Math.floor((secs % 3600) / 60);
    const sec = Math.floor(secs % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

/** YYYYMMDD of the day before `dayStr` (YYYYMMDD). */
export const getPreviousDateString = (dayStr: string): string =>
    formatYmd(new Date(Date.UTC(Number(dayStr.slice(0, 4)), Number(dayStr.slice(4, 6)) - 1, Number(dayStr.slice(6, 8)) - 1)));

/**
 * Converts a zone-less local wall-clock timestamp (`YYYY-MM-DD HH:MM:SS`) to epoch milliseconds.
 * Returns null if the timestamp cannot be parsed.
 */
export const zonedLocalToEpochMs = (local: string, timezone: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
    if (!m) return null;

    const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
    // Resolving the offset at the shifted instant keeps this correct on either side of a DST change.
    return asUtc - zoneOffsetMs(timezone, asUtc - zoneOffsetMs(timezone, asUtc));
};
