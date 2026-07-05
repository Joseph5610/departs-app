import { useQuery } from '@tanstack/react-query';
import { useRef, useMemo } from 'react';
import type { Departure } from '../../types/transit';
import { useRouteParams } from '../../hooks/useRouteParams';
import { useSelectionStore } from '../../state/selectionStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { TRANSIT_REFRESH_MS } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';
import type { AppError } from '../../types/error';

export interface DepartureSubGroup {
    groupId: string;
    headsign: string;
    departures: Departure[];
    firstTime: number;
}

export interface DepartureLineGroup {
    lineGroupId: string;
    line: string | number;
    type: string | number;
    subGroups: DepartureSubGroup[];
    firstTime: number;
}

export type DelayTrend = 'improving' | 'worsening' | 'stable';

export interface DelayStats {
    averageDelayMin: number;
    trend: DelayTrend;
    sampleSize: number;
}

export interface DeparturesResponse {
    departures: Departure[];
}

/**
 * useDepartures
 *
 * Fetches, enriches, and groups departure data for the selected stop.
 */
export const useDepartures = () => {
    const { stopId } = useRouteParams();
    const selectedLine = useSelectionStore(s => s.selectedLine);
    const requireAirConditioned = usePreferencesStore(s => s.requireAirConditioned);
    const departureSort = usePreferencesStore(s => s.departureSort);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    // Store previous data to calculate deltas without effects
    const prevDataRef = useRef<Record<string, { delay: number; timestamp: number }>>({});


    const query = useQuery<DeparturesResponse | null, AppError>({
        queryKey: ['departures', selectedCity, stopId],
        queryFn: async () => {
            if (!stopId || !selectedCity) {
                return null;
            }
            const data = await apiFetch<DeparturesResponse>(`/${selectedCity}/departures?stopId=${encodeURIComponent(stopId)}`);
            
            if (!data?.departures) return data;
            
            const now = Date.now();
            const enriched: Departure[] = data.departures.map((dep: Departure) => {
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

                // Update ref immediately for the next fetch
                prevDataRef.current[key] = {
                    delay: dep.delay,
                    timestamp: lastUpdate || now
                };

                return {
                    ...dep,
                    delayDelta: delta,
                    lastDelayUpdate: lastUpdate
                };
            });

            return {
                ...data,
                departures: enriched
            };
        },
        enabled: !!stopId,
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: TRANSIT_REFRESH_MS
    });

    const enrichedDepartures = useMemo((): Departure[] => query.data?.departures || [], [query.data]);

    const hasAirConditioningData = useMemo(() => {
        return enrichedDepartures.some(dep => dep.is_air_conditioned === true);
    }, [enrichedDepartures]);

    const filteredDepartures = useMemo(() => {
        let result = enrichedDepartures;
        if (selectedLine) {
            result = result.filter(dep => String(dep.line).toUpperCase() === selectedLine.toUpperCase());
        }
        // Only apply AC filter when this stop actually has AC vehicles — if none have AC data,
        // silently ignore the persistent preference so the board never goes empty unexpectedly.
        if (requireAirConditioned && hasAirConditioningData) {
            result = result.filter(dep => dep.is_air_conditioned === true);
        }
        return result;
    }, [enrichedDepartures, selectedLine, requireAirConditioned, hasAirConditioningData]);

    const groupedDepartures = useMemo((): DepartureLineGroup[] => {
        if (filteredDepartures.length === 0) return [];

        // 1. Group by Line -> DirectionId -> Headsign
        const lineMap = new Map<string, Map<string, Map<string, Departure[]>>>();
        filteredDepartures.forEach((dep) => {
            const line = String(dep.line).toUpperCase();
            if (!lineMap.has(line)) lineMap.set(line, new Map());
            
            const dirId = String(dep.directionId ?? '');
            const dirMap = lineMap.get(line)!;
            if (!dirMap.has(dirId)) dirMap.set(dirId, new Map());
            
            const headsignMap = dirMap.get(dirId)!;
            if (!headsignMap.has(dep.headsign)) headsignMap.set(dep.headsign, []);
            headsignMap.get(dep.headsign)!.push(dep);
        });

        // 2. Merge direction groups that share the same headsign for the same line
        const result: DepartureLineGroup[] = [];
        lineMap.forEach((dirMap, line) => {
            const mergedDirs: Array<{ ids: Set<string>; headsigns: Map<string, Departure[]> }> = [];
            const headsignToTarget = new Map<string, { ids: Set<string>; headsigns: Map<string, Departure[]> }>();
            
            dirMap.forEach((headsignMap, dirId) => {
                let target: { ids: Set<string>; headsigns: Map<string, Departure[]> } | undefined;

                for (const hs of headsignMap.keys()) {
                    if (headsignToTarget.has(hs)) {
                        target = headsignToTarget.get(hs);
                        break;
                    }
                }

                if (!target) {
                    target = { ids: new Set(), headsigns: new Map() };
                    mergedDirs.push(target);
                }
                
                target.ids.add(dirId);
                headsignMap.forEach((deps, hs) => {
                    if (!target!.headsigns.has(hs)) target!.headsigns.set(hs, []);
                    target!.headsigns.get(hs)!.push(...deps);
                    headsignToTarget.set(hs, target!);
                });
            });

            // 3. Convert to final structure
            mergedDirs.forEach((md) => {
                const subGroups: DepartureSubGroup[] = Array.from(md.headsigns.entries())
                    .map(([headsign, deps]) => ({
                        groupId: `${line}-${Array.from(md.ids).join('_')}-${headsign}`,
                        headsign,
                        departures: deps.sort((a, b) => new Date(a.scheduled).getTime() - new Date(b.scheduled).getTime()),
                        firstTime: Math.min(...deps.map(d => new Date(d.timestamp).getTime()))
                    }))
                    .sort((a, b) => a.firstTime - b.firstTime);

                const firstDep = subGroups[0].departures[0];
                result.push({
                    lineGroupId: `${line}-${Array.from(md.ids).join('_')}`,
                    line: firstDep.line,
                    type: firstDep.type,
                    subGroups,
                    firstTime: subGroups[0].firstTime
                });
            });
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
    }, [filteredDepartures, departureSort]);

    const delayStats = useMemo((): DelayStats | null => {
        if (!filteredDepartures || filteredDepartures.length === 0) return null;

        const now = query.dataUpdatedAt;
        const thirtyMinsFromNow = now + 30 * 60 * 1000;

        // Only count vehicles that have real-time data and are expected in the next 30 minutes
        const realTimeDeps = filteredDepartures.filter((d: Departure) => {
            if (typeof d.delay !== 'number') return false;
            const expectedTime = new Date(d.timestamp).getTime();
            return expectedTime <= thirtyMinsFromNow;
        });

        if (realTimeDeps.length === 0) return null;

        const totalDelay = realTimeDeps.reduce((sum: number, d: Departure) => sum + (d.delay || 0), 0);
        const averageDelayMin = Math.round(totalDelay / realTimeDeps.length / 60);

        // Calculate trend based on recent delayDelta > 0 (worsening) vs < 0 (improving)
        const deltas = realTimeDeps.filter((d: Departure) => d.delayDelta !== undefined && d.delayDelta !== 0);
        let trend: DelayTrend = 'stable';
        if (deltas.length > 0) {
            const deltaSum = deltas.reduce((sum: number, d: Departure) => sum + (d.delayDelta || 0), 0);
            if (deltaSum > 30) trend = 'worsening'; // More than 30 seconds total recent worsening
            else if (deltaSum < -30) trend = 'improving';
        }

        return { averageDelayMin, trend, sampleSize: realTimeDeps.length };
    }, [filteredDepartures, query.dataUpdatedAt]);

    return { ...query, groupedDepartures, delayStats, isFiltered: !!selectedLine || (requireAirConditioned && hasAirConditioningData), selectedLine, hasAirConditioningData };
};
