
/** Local wall-clock from a cached UTC offset, rather than formatting on every call. */
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetCache = new Map<string, { hourBucket: number; offsetMs: number }>();

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

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
    if (secs < 0) secs += 86400;
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
export const getMinutesUntil = (timeStr: string, timezone: string): number => {
    const targetSecs = toSecs(timeStr);
    const currentSecs = getCurrentLocalSeconds(timezone);
    let diffSecs = targetSecs - currentSecs;
    if (diffSecs < -43200) diffSecs += 86400; // -12h wrap
    if (diffSecs > 43200) diffSecs -= 86400;  // +12h wrap
    return diffSecs / 60;
};

/**
 * Returns the current date in YYYYMMDD format for a given IANA timezone.
 */
export const getZonedDateString = (timezone: string): string => {
    const nowMs = Date.now();
    // Shifting by the offset makes the UTC calendar fields read as the zone's local ones.
    const local = new Date(nowMs + zoneOffsetMs(timezone, nowMs));
    return `${local.getUTCFullYear()}${String(local.getUTCMonth() + 1).padStart(2, '0')}${String(local.getUTCDate()).padStart(2, '0')}`;
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
