
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
 * Formats a delay in seconds into a human readable string (+M:SS or +Ss).
 */
export const formatDelay = (seconds: number) => {
    if (seconds <= 30) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `+${secs}s`;
    return `+${mins}:${secs.toString().padStart(2, '0')}`;
};
