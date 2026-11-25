import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '@/config/constants';
import { queryKeys } from '@/lib/queryKeys';
import type { IndoorPlan } from '@/types';

/** One station's floor plan (`indoor/<station>.json`); `version` (the file's hash) keeps CDN copies of older files out. */
export function useIndoorPlan(station: string | null, version: string | undefined) {
    return useQuery<IndoorPlan>({
        queryKey: queryKeys.indoorPlan(station, version),
        queryFn: ({ signal }) => apiFetch<IndoorPlan>(`${EXTERNAL_URLS.STATIC_DATA}/indoor/${encodeURIComponent(station!)}.json?v=${version}`, { signal }),
        enabled: station !== null && version !== undefined,
        staleTime: QUERY_TIMING_MS.STATIC_METADATA_STALE,
        gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
        retry: false,
    });
}
