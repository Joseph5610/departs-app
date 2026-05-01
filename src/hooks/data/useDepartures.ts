import { useQuery } from '@tanstack/react-query';
import { useRef, useMemo, useEffect } from 'react';
import type { Departure } from '../../types/transit';
import { useSelection, usePreferences } from '../../state/MapStateProvider';
import { TRANSIT_REFRESH_MS } from '../../config/constants';

export interface DepartureGroup {
    groupId: string;
    line: string;
    type: string | number;
    departures: Departure[];
    firstTime: number;
}

export type DelayTrend = 'improving' | 'worsening' | 'stable';

export interface DelayStats {
    averageDelayMin: number;
    trend: DelayTrend;
    sampleSize: number;
}

/**
 * useDepartures
 *
 * Fetches, enriches, and groups departure data for the selected stop.
 */
export const useDepartures = () => {
    const { state: selState } = useSelection();
    const { state: prefState } = usePreferences();
    const stopId = selState.selectedStopId;
    const departureSort = prefState.departureSort;

    // Store previous data to calculate deltas without effects
    const prevDataRef = useRef<Record<string, { delay: number; timestamp: number }>>({});


    const query = useQuery({
        queryKey: ['departures', stopId],
        queryFn: async () => {
            if (!stopId) {
                return null;
            }
            const res = await fetch(`/api/departures?stopId=${encodeURIComponent(stopId)}`);
            if (!res.ok) {
                throw new Error('Failed to fetch departures');
            }
            return res.json();
        },
        enabled: !!stopId,
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: TRANSIT_REFRESH_MS,
    });

    const enrichedDepartures = useMemo((): Departure[] => {
        if (!query.data?.departures) return [];

        const now = Date.now();
        return query.data.departures.map((dep: Departure) => {
            const key = `${dep.tripId}-${dep.scheduled}`;
            const prev = prevDataRef.current[key];

            let delta: number | undefined = undefined;
            let lastUpdate: number | undefined = undefined;

            if (prev && prev.delay !== dep.delay) {
                delta = dep.delay - prev.delay;
                lastUpdate = now;
            } else if (prev) {
                lastUpdate = prev.timestamp;
            }

            return {
                ...dep,
                delayDelta: delta,
                lastDelayUpdate: lastUpdate
            };
        });
    }, [query.data, query.dataUpdatedAt]);

    // Synchronize ref AFTER render to maintain purity
    useEffect(() => {
        if (!query.data?.departures) return;

        const now = Date.now();
        query.data.departures.forEach((dep: Departure) => {
            const key = `${dep.tripId}-${dep.scheduled}`;
            const prev = prevDataRef.current[key];
            const lastUpdate = (prev && prev.delay !== dep.delay) ? now : prev?.timestamp;

            prevDataRef.current[key] = {
                delay: dep.delay,
                timestamp: lastUpdate || now
            };
        });
    }, [query.data]);

    const groupedDepartures = useMemo((): DepartureGroup[] => {
        if (enrichedDepartures.length === 0) {
            return [];
        }
        const groups: Record<string, Departure[]> = {};
        enrichedDepartures.forEach((dep) => {
            // Metro (type 1) is grouped by line AND direction
            const lineName = String(dep.line).toUpperCase();
            const isMetro = String(dep.type) === '1' || ['A', 'B', 'C'].includes(lineName);
            const key = isMetro ? `${lineName}-${dep.directionId}` : lineName;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(dep);
        });

        const result = Object.entries(groups).map(([key, deps]) => {
            return {
                groupId: key,
                line: deps[0].line,
                type: deps[0].type,
                departures: deps,
                firstTime: new Date(deps[0].timestamp).getTime()
            };
        });

        if (departureSort === 'line') {
            result.sort((a, b) => {
                const typeA = Number(a.type) || 0;
                const typeB = Number(b.type) || 0;
                if (typeA !== typeB) {
                    return typeA - typeB;
                }

                const lineA = String(a.line);
                const lineB = String(b.line);
                if (lineA !== lineB) {
                    return lineA.localeCompare(lineB, undefined, { numeric: true, sensitivity: 'base' });
                }

                return a.firstTime - b.firstTime;
            });
        } else {
            result.sort((a, b) => { return a.firstTime - b.firstTime; });
        }
        return result;
    }, [enrichedDepartures, departureSort]);

    const delayStats = useMemo((): DelayStats | null => {
        if (!enrichedDepartures || enrichedDepartures.length === 0) return null;
        
        const now = Date.now();
        const thirtyMinsFromNow = now + 30 * 60 * 1000;

        // Only count vehicles that have real-time data and are expected in the next 30 minutes
        const realTimeDeps = enrichedDepartures.filter(d => {
            if (typeof d.delay !== 'number') return false;
            const expectedTime = new Date(d.timestamp).getTime();
            return expectedTime <= thirtyMinsFromNow;
        });
        
        if (realTimeDeps.length === 0) return null;

        const totalDelay = realTimeDeps.reduce((sum, d) => sum + (d.delay || 0), 0);
        const averageDelayMin = Math.round(totalDelay / realTimeDeps.length / 60);
        
        // Calculate trend based on recent delayDelta > 0 (worsening) vs < 0 (improving)
        const deltas = realTimeDeps.filter(d => d.delayDelta !== undefined && d.delayDelta !== 0);
        let trend: DelayTrend = 'stable';
        if (deltas.length > 0) {
            const deltaSum = deltas.reduce((sum, d) => sum + (d.delayDelta || 0), 0);
            if (deltaSum > 30) trend = 'worsening'; // More than 30 seconds total recent worsening
            else if (deltaSum < -30) trend = 'improving';
        }

        return { averageDelayMin, trend, sampleSize: realTimeDeps.length };
    }, [enrichedDepartures]);

    return { ...query, groupedDepartures, delayStats };
};
