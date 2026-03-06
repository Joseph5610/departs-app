
/**
 * Generic date utilities for the transit application.
 */

/**
 * Checks if a timestamp is relatively fresh (e.g. within last 5 minutes).
 */
export const isFresh = (timestamp: string | number | Date, maxAgeMinutes = 5): boolean => {
    try {
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return false;
        const now = new Date();
        return (now.getTime() - d.getTime()) < (maxAgeMinutes * 60 * 1000);
    } catch {
        return false;
    }
};

/**
 * Formats a delay in seconds into a human readable string (±M:SS or ±Ss).
 */
export const formatDelay = (seconds: number | null | undefined) => {
    if (seconds === 0 || seconds === null || seconds === undefined || isNaN(seconds)) return '';

    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const sign = seconds > 0 ? '+' : '-';

    if (mins === 0) return `${sign}${secs}s`;
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
};
