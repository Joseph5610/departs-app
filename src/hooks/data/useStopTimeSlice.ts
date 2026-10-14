import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';
import { secondsOfDayIn } from '@/domain/time';
import { DELAY_ESTIMATE_CONFIG, EXTERNAL_URLS, QUERY_TIMING_MS } from '@/config/constants';
import type { StopTimeSlice } from '@/types';

/**
 * The timetable of every trip running in the city's current hour, for estimating delays the feed does not
 * report. `atMs` (the fleet's last update, 0 before the first) picks the hour; the previous hour's slice is held while the next loads.
 */
export function useStopTimeSlice(city: string, timeZone: string, enabled: boolean, atMs: number): StopTimeSlice | null {
    const hour = String(Math.floor(secondsOfDayIn(timeZone, atMs) / 3600) % 24).padStart(2, '0');
    const { data } = useQuery({
        queryKey: queryKeys.stopTimeSlice(city, hour),
        queryFn: ({ signal }) => apiFetch<StopTimeSlice>(`${EXTERNAL_URLS.STATIC_DATA}/${city}/stop_times/${hour}.json`, { signal }),
        enabled: enabled && !!city && atMs > 0,
        staleTime: QUERY_TIMING_MS.TRIP_SHAPES_STALE,
        gcTime: QUERY_TIMING_MS.TRIP_SHAPES_GC,
        placeholderData: keepPreviousData,
        refetchInterval: (query) => (query.state.status === 'error' ? DELAY_ESTIMATE_CONFIG.SLICE_RETRY_MS : false),
    });
    return enabled ? data ?? null : null;
}
