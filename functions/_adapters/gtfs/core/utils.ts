
/**
 * Helper: convert HH:MM:SS to seconds of day
 */
export const toSecs = (t: string) => { 
    const [h, m, s] = t.split(':').map(Number); 
    return h * 3600 + m * 60 + (s || 0); 
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




