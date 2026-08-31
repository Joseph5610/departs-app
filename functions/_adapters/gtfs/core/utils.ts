
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
export const getCurrentLocalSeconds = (timezone = 'Europe/Prague'): number => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    });
    const pMap: Record<string, string> = {};
    for (const p of formatter.formatToParts(now)) {
        pMap[p.type] = p.value;
    }
    const h = Number(pMap.hour || 0) % 24;
    const m = Number(pMap.minute || 0);
    const s = Number(pMap.second || 0);
    return h * 3600 + m * 60 + s;
};

/**
 * Calculates the difference in minutes between a target time (HH:MM:SS) and current local time.
 * Handles bidirectional 24h midnight wrap-around.
 */
export const getMinutesUntil = (timeStr: string, timezone = 'Europe/Prague'): number => {
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
export const getZonedDateString = (timezone = 'Europe/Prague'): string => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const y = parts.find(p => p.type === 'year')?.value || '';
    const m = parts.find(p => p.type === 'month')?.value || '';
    const d = parts.find(p => p.type === 'day')?.value || '';
    return `${y}${m}${d}`;
};

/**
 * Converts an ISO timestamp string to local seconds since midnight in the given IANA timezone.
 * Returns null if the timestamp is invalid.
 */
export const getLocalSecondsFromISO = (isoString: string, timezone = 'Europe/Prague'): number | null => {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    });
    
    const pMap: Record<string, string> = {};
    for (const p of formatter.formatToParts(date)) {
        pMap[p.type] = p.value;
    }
    
    const h = Number(pMap.hour || 0) % 24;
    const m = Number(pMap.minute || 0);
    const s = Number(pMap.second || 0);
    
    return h * 3600 + m * 60 + s;
};
