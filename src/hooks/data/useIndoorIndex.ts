import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { EXTERNAL_URLS, INDOOR_MAP, QUERY_TIMING_MS } from '@/config/constants';
import { queryKeys } from '@/lib/queryKeys';
import type { IndoorIndex } from '@/types';

const NO_STATIONS: IndoorIndex = { version: 4, stations: {} };

/** The stations with a floor plan (`indoor/index.json`); loaded only once the map is close enough to need it. */
export function useIndoorIndex(enabled: boolean) {
    return useQuery<IndoorIndex>({
        queryKey: queryKeys.indoorIndex(),
        queryFn: async ({ signal }) => {
            const index = await apiFetch<IndoorIndex>(`${EXTERNAL_URLS.STATIC_DATA}/indoor/index.json?h=${Math.floor(Date.now() / INDOOR_MAP.INDEX_REFRESH_MS)}`, { signal });
            // An index in another format (before or after a departs-data release) shows no plans rather than misreading them.
            return index.version === 4 ? index : NO_STATIONS;
        },
        enabled,
        staleTime: INDOOR_MAP.INDEX_REFRESH_MS,
        gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
        retry: false,
    });
}
