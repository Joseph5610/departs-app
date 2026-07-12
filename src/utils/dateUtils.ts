/**
 * Formats a delay in seconds into a human readable string (±M:SS or ±Ss).
 */
export const formatDelay = (seconds: number | null | undefined): string | null => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return null;
    if (seconds === 0) return '';

    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const sign = seconds > 0 ? '+' : '-';

    if (mins === 0) return `${sign}${secs}s`;
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Calculates the difference between two HH:MM:SS times in seconds.
 * Returns positive if realtime is later than scheduled (late).
 * Handles midnight crossovers safely.
 */
export const calculateTimeDifferenceSecs = (realtimeTime: string, scheduledTime: string): number => {
    const toSecs = (t: string) => {
        const [h, m, s] = t.split(':').map(Number);
        return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };

    const rtSecs = toSecs(realtimeTime);
    const schedSecs = toSecs(scheduledTime);
    let diff = rtSecs - schedSecs;

    if (diff < -43200) diff += 86400;
    if (diff > 43200) diff -= 86400;

    return diff;
};

/**
 * Formats a timestamp (ISO string or ms number) into a locale-aware date+time string.
 * Example (cs): "12. 7. 2026, 00:30"
 */
export const formatDateTime = (value: string | number, locale: string): string => {
    return new Date(value).toLocaleString(locale, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
