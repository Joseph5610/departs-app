import { useQuery } from '@tanstack/react-query';
import { fetchStaticIndex } from '@/lib/staticIndex';
import { INDOOR_MAP, QUERY_TIMING_MS } from '@/config/constants';
import { queryKeys } from '@/lib/queryKeys';
import type { IndoorIndex } from '@/types';

const NO_STATIONS: IndoorIndex = { version: 4, stations: {} };

/** The stations with a floor plan (`indoor/index.json`); loaded only once the map is close enough to need it. */
export function useIndoorIndex(enabled: boolean) {
    return useQuery<IndoorIndex>({
        queryKey: queryKeys.indoorIndex(),
        queryFn: ({ signal }) => fetchStaticIndex('indoor/index.json', 4, NO_STATIONS, signal),
        enabled,
        staleTime: INDOOR_MAP.INDEX_REFRESH_MS,
        gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
        retry: false,
    });
}
