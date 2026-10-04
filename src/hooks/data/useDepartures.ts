import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Departure } from '../../types/transit';
import { useRouteParams } from '../../hooks/useRouteParams';
import { useSelectionStore } from '../../state/selectionStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { LIVE_FETCH_OPTIONS, DELAY_STATS_WINDOW_MS, DEPARTURES_CONFIG } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';
import type { AppError } from '../../types/error';
import { enrichLiveDepartures } from '../../lib/enrichment';
import { memoizeLast } from '../../lib/memoize';
import { routeTypeRank } from '../../config/transit';
import { useEnrichmentStore } from '../../state/enrichmentStore';
import { useVehicles } from './useVehicles';
import { useRouteMetadata } from './useRouteMetadata';
import { useFleetLookup } from './useVehicleMetadata';

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

/** Adds how much each departure's delay changed since the stop's previous (recent) fetch. */
const withDelayDeltas = (departures: Departure[], previous: Departure[] | undefined, previousFetchedAt: number): Departure[] => {
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

/** Departures of one or more stops; `stopId` repeats per stop. */
export const fetchDepartures = (city: string, stopIds: string[], signal?: AbortSignal): Promise<DeparturesResponse> => {
    const params = new URLSearchParams();
    for (const id of stopIds) params.append('stopId', id);
    return apiFetch<DeparturesResponse>(`/${city}/departures?${params.toString()}`, { ...LIVE_FETCH_OPTIONS, signal });
};

/**
 * Fetched departures run through the live pipeline against the current fleet, push patches, route
 * branding and fleet register. `enrich` must be a module-level `memoizeLast` owned by the caller.
 */
export const useLiveDepartures = (departures: Departure[], dataUpdatedAt: number, enrich: typeof enrichLiveDepartures): Departure[] => {
    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);
    const { tripIndex } = useVehicles();
    const { byShortName, byId } = useRouteMetadata();
    const fleet = useFleetLookup();
    return enrich(departures, tripIndex, byTripId, byVehicleId, byShortName, byId, dataUpdatedAt, fleet);
};

const enrichStopDepartures = memoizeLast(enrichLiveDepartures);

const filterDepartures = memoizeLast((departures: Departure[], selectedLine: string | null, requireAirConditioned: boolean) => {
    const hasAirConditioningData = departures.some(dep => dep.is_air_conditioned === true);
    const hasRequestStop = departures.some(dep => dep.is_request_stop === true);

    let filtered = departures;
    if (selectedLine) {
        filtered = filtered.filter(dep => String(dep.line).toUpperCase() === selectedLine.toUpperCase());
    }
    // Ignore the persistent AC preference at stops without AC data, so the board never goes empty unexpectedly.
    if (requireAirConditioned && hasAirConditioningData) {
        filtered = filtered.filter(dep => dep.is_air_conditioned === true);
    }
    return { filtered, hasAirConditioningData, hasRequestStop };
});

const groupDepartures = memoizeLast((departures: Departure[], departureSort: 'line' | 'departure'): DepartureLineGroup[] => {
    if (departures.length === 0) return [];

    // 1. Group by Line -> DirectionId -> Headsign
    const lineMap = new Map<string, Map<string, Map<string, Departure[]>>>();
    departures.forEach((dep) => {
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
            const rankDiff = routeTypeRank(a.type) - routeTypeRank(b.type);
            if (rankDiff !== 0) return rankDiff;

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
});

const computeDelayStats = memoizeLast((departures: Departure[], dataUpdatedAt: number): DelayStats | null => {
    if (departures.length === 0) return null;

    const statsWindowEnd = dataUpdatedAt + DELAY_STATS_WINDOW_MS;

    // Only count vehicles that have real-time data and are expected within the stats window
    const realTimeDeps = departures.filter((d: Departure) => {
        if (typeof d.delay !== 'number') return false;
        return new Date(d.timestamp).getTime() <= statsWindowEnd;
    });

    if (realTimeDeps.length === 0) return null;

    const totalDelay = realTimeDeps.reduce((sum: number, d: Departure) => sum + (d.delay || 0), 0);
    const averageDelayMin = Math.round(totalDelay / realTimeDeps.length / 60);

    const deltas = realTimeDeps.filter((d: Departure) => d.delayDelta !== undefined && d.delayDelta !== 0);
    let trend: DelayTrend = 'stable';
    if (deltas.length > 0) {
        const deltaSum = deltas.reduce((sum: number, d: Departure) => sum + (d.delayDelta || 0), 0);
        if (deltaSum > DEPARTURES_CONFIG.TREND_THRESHOLD_S) trend = 'worsening';
        else if (deltaSum < -DEPARTURES_CONFIG.TREND_THRESHOLD_S) trend = 'improving';
    }

    return { averageDelayMin, trend, sampleSize: realTimeDeps.length };
});

const NO_DEPARTURES: Departure[] = [];

/**
 * useDepartures
 *
 * Fetches, enriches, and groups departure data for the selected stop. The derived values are shared
 * between the components that use it (board, header, title) rather than recomputed by each.
 */
export const useDepartures = () => {
    const { stopId } = useRouteParams();
    const selectedLine = useSelectionStore(s => s.selectedLine);
    const requireAirConditioned = usePreferencesStore(s => s.requireAirConditioned);
    const departureSort = usePreferencesStore(s => s.departureSort);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;

    const query = useQuery<DeparturesResponse | null, AppError>({
        queryKey: ['departures', selectedCity, stopId],
        queryFn: async ({ client, queryKey, signal }) => {
            if (!stopId || !selectedCity) {
                return null;
            }
            const data = await fetchDepartures(selectedCity, [stopId], signal);
            if (!data?.departures) return data;
            const previous = client.getQueryState<DeparturesResponse | null>(queryKey);
            const isRecent = !!previous && Date.now() - previous.dataUpdatedAt <= refreshMs * DEPARTURES_CONFIG.DELAY_DELTA_MAX_AGE_REFRESHES;
            return { ...data, departures: withDelayDeltas(data.departures, isRecent ? previous.data?.departures : undefined, previous?.dataUpdatedAt ?? Date.now()) };
        },
        enabled: !!stopId,
        refetchInterval: refreshMs,
        staleTime: refreshMs,
        retry: false,
    });

    const dataUpdatedAt = query.dataUpdatedAt || 0;
    const liveDepartures = useLiveDepartures(query.data?.departures ?? NO_DEPARTURES, dataUpdatedAt, enrichStopDepartures);
    const { filtered, hasAirConditioningData, hasRequestStop } = filterDepartures(liveDepartures, selectedLine, requireAirConditioned);
    const groupedDepartures = groupDepartures(filtered, departureSort);
    const delayStats = computeDelayStats(filtered, dataUpdatedAt);
    const isFiltered = !!selectedLine || (requireAirConditioned && hasAirConditioningData);

    const { data, isLoading, isError, error, refetch } = query;

    return useMemo(() => ({
        data,
        liveDepartures,
        isLoading,
        isError,
        error,
        refetch,
        groupedDepartures,
        delayStats,
        isFiltered,
        selectedLine,
        hasAirConditioningData,
        hasRequestStop,
    }), [data, liveDepartures, isLoading, isError, error, refetch, groupedDepartures, delayStats, isFiltered, selectedLine, hasAirConditioningData, hasRequestStop]);
};
