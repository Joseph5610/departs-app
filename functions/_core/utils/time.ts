const displayFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * `hourCycle: 'h23'` rather than `hour12: false`, which ECMA-402 leaves free to resolve to h24 and
 * render midnight as "24".
 */
function getDisplayFormatter(timezone: string, withDate: boolean): Intl.DateTimeFormat {
    const key = `${timezone}|${withDate}`;
    let formatter = displayFormatters.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('cs-CZ', {
            timeZone: timezone,
            ...(withDate ? { day: 'numeric', month: 'numeric', year: 'numeric' } : {}),
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        });
        displayFormatters.set(key, formatter);
    }
    return formatter;
}

/** Formats a date as `D. M. YYYY HH:mm` in the given IANA timezone. */
export function formatDate(date: Date, timezone: string): string {
    return getDisplayFormatter(timezone, true).format(date);
}

/** Formats a date as `HH:mm` in the given IANA timezone. */
export function formatTime(date: Date, timezone: string): string {
    return getDisplayFormatter(timezone, false).format(date);
}

/** Local wall-clock from a cached UTC offset, rather than formatting on every call. */
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetCache = new Map<string, { hourBucket: number; offsetMs: number }>();

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const DAY_SECS = 86_400;
const HALF_DAY_SECS = 43_200;

function zoneOffsetMs(timezone: string, atMs: number): number {
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
        ? (parsed[1] === '-' ? -1 : 1) * (Number(parsed[2]) * 3_600_000 + Number(parsed[3]) * 60_000)
        : 0;

    offsetCache.set(timezone, { hourBucket, offsetMs });
    return offsetMs;
}

/** Local seconds since midnight for an instant, in the given zone. */
const localSecondsOf = (atMs: number, timezone: string): number => {
    const local = atMs + zoneOffsetMs(timezone, atMs);
    return Math.floor((((local % DAY_MS) + DAY_MS) % DAY_MS) / 1000);
};

/** Formats the UTC calendar fields of `date` as YYYYMMDD. */
const formatYmd = (date: Date): string =>
    `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;

/**
 * Wraps a difference between two times of day into [-12h, +12h], so times either side of
 * midnight compare as close together rather than a day apart.
 */
export const wrapDaySeconds = (diffSecs: number): number => {
    if (diffSecs < -HALF_DAY_SECS) return diffSecs + DAY_SECS;
    if (diffSecs > HALF_DAY_SECS) return diffSecs - DAY_SECS;
    return diffSecs;
};

/**
 * Helper: convert HH:MM:SS (or HH:MM) to seconds of day
 */
export const toSecs = (t: string): number => { 
    const [h, m, s] = t.split(':').map(Number); 
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0); 
};

/**
 * Helper: add delay in seconds to HH:MM:SS string.
 * Wraps around midnight properly.
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

/**
 * Returns current local time in seconds since midnight for a given IANA timezone.
 */
export const getCurrentLocalSeconds = (timezone: string): number =>
    localSecondsOf(Date.now(), timezone);

/**
 * Calculates the difference in minutes between a target time (HH:MM:SS) and current local time.
 * Handles bidirectional 24h midnight wrap-around.
 */
export const getMinutesUntil = (timeStr: string, timezone: string): number =>
    wrapDaySeconds(toSecs(timeStr) - getCurrentLocalSeconds(timezone)) / 60;

/**
 * Returns the current date in YYYYMMDD format for a given IANA timezone.
 */
export const getZonedDateString = (timezone: string): string => {
    const nowMs = Date.now();
    // Shifting by the offset makes the UTC calendar fields read as the zone's local ones.
    return formatYmd(new Date(nowMs + zoneOffsetMs(timezone, nowMs)));
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

/**
 * Converts an ISO timestamp string to local seconds since midnight in the given IANA timezone.
 * Returns null if the timestamp is invalid.
 */
export const getLocalSecondsFromISO = (isoString: string, timezone: string): number | null => {
    const atMs = new Date(isoString).getTime();
    if (isNaN(atMs)) return null;

    return localSecondsOf(atMs, timezone);
};
