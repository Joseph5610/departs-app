import type { Departure } from '@/types';
import { DEPARTURES_CONFIG } from '@/config/constants';

type DelayTrend = 'improving' | 'worsening' | 'stable';

interface DelayStats {
    averageDelayMin: number;
    trend: DelayTrend;
    sampleSize: number;
}

/** Adds how much each departure's delay changed since the stop's previous (recent) fetch. */
export const withDelayDeltas = (departures: Departure[], previous: Departure[] | undefined, previousFetchedAt: number): Departure[] => {
    const previousByKey = new Map<string, Departure>();
    for (const dep of previous ?? []) previousByKey.set(`${dep.tripId}-${dep.scheduled}`, dep);
    const now = Date.now();

    return departures.map((dep) => {
        const prev = previousByKey.get(`${dep.tripId}-${dep.scheduled}`);
        if (!prev) return { ...dep, delayDelta: undefined, lastDelayUpdate: undefined };

        if (prev.delay !== dep.delay && prev.delay !== null && dep.delay !== null) {
            return { ...dep, delayDelta: dep.delay - prev.delay, lastDelayUpdate: now };
        }
        return { ...dep, delayDelta: undefined, lastDelayUpdate: prev.lastDelayUpdate ?? previousFetchedAt };
    });
};

/** The board header's average delay and trend: realtime departures within the stats window only. */
export const computeDelayStats = (departures: Departure[], dataUpdatedAt: number): DelayStats | null => {
    if (departures.length === 0) return null;

    const statsWindowEnd = dataUpdatedAt + DEPARTURES_CONFIG.DELAY_STATS_WINDOW_MS;

    const realTimeDeps = departures.filter(d => typeof d.delay === 'number' && Date.parse(d.timestamp) <= statsWindowEnd);

    if (realTimeDeps.length === 0) return null;

    const totalDelay = realTimeDeps.reduce((sum, d) => sum + (d.delay || 0), 0);
    const averageDelayMin = Math.round(totalDelay / realTimeDeps.length / 60);

    const deltas = realTimeDeps.filter(d => d.delayDelta !== undefined && d.delayDelta !== 0);
    let trend: DelayTrend = 'stable';
    if (deltas.length > 0) {
        const deltaSum = deltas.reduce((sum, d) => sum + (d.delayDelta || 0), 0);
        if (deltaSum > DEPARTURES_CONFIG.TREND_THRESHOLD_S) trend = 'worsening';
        else if (deltaSum < -DEPARTURES_CONFIG.TREND_THRESHOLD_S) trend = 'improving';
    }

    return { averageDelayMin, trend, sampleSize: realTimeDeps.length };
};
