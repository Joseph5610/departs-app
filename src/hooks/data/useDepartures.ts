import { useQuery } from '@tanstack/react-query';
import { useRef, useCallback, useMemo } from 'react';
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

    const selectFn = useCallback((data: { departures: Departure[] }) => {
        if (!data?.departures) {
            return data;
        }

        const now = Date.now();
        const enriched = data.departures.map((dep) => {
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

            // Update ref for next run
            prevDataRef.current[key] = { delay: dep.delay, timestamp: lastUpdate || now };

            return {
                ...dep,
                delayDelta: delta,
                lastDelayUpdate: lastUpdate
            };
        });

        return { departures: enriched };
    }, []);

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
        select: selectFn,
        enabled: !!stopId,
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: TRANSIT_REFRESH_MS,
    });

    const groupedDepartures = useMemo((): DepartureGroup[] => {
        if (!query.data?.departures) {
            return [];
        }
        const groups: Record<string, Departure[]> = {};
        query.data.departures.forEach((dep) => {
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
    }, [query.data, departureSort]);

    return { ...query, groupedDepartures };
};
