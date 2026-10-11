import { useEffect, useState } from 'react';
import { DEPARTURES_CONFIG } from '@/config/constants';

/**
 * Whether a delay change just arrived: true from a new non-zero `delta` until DELAY_DELTA_VISIBLE_MS after
 * its `lastUpdate`, so the board can show the trend briefly and settle back.
 */
export const useRecentDelta = (delta: number, lastUpdate?: number): boolean => {
    const [visible, setVisible] = useState(false);
    const [prevLastUpdate, setPrevLastUpdate] = useState<number | undefined>(undefined);

    if (lastUpdate !== prevLastUpdate) {
        setPrevLastUpdate(lastUpdate);
        if (delta !== 0 && lastUpdate) setVisible(true);
    }

    useEffect(() => {
        if (!visible || !lastUpdate) return;
        const remaining = Math.max(0, DEPARTURES_CONFIG.DELAY_DELTA_VISIBLE_MS - (Date.now() - lastUpdate));
        const timer = setTimeout(() => setVisible(false), remaining);
        return () => clearTimeout(timer);
    }, [visible, lastUpdate]);

    return visible && delta !== 0;
};
