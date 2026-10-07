import { DELAY_BADGE_TOLERANCE_S } from '@/config/transit';

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

/** How a delay reads on vehicle badges and stop times. */
export type DelayStatus = 'late' | 'early' | 'onTime';

export const getDelayStatus = (delaySec: number): DelayStatus =>
    delaySec > DELAY_BADGE_TOLERANCE_S ? 'late' : delaySec < -DELAY_BADGE_TOLERANCE_S ? 'early' : 'onTime';
