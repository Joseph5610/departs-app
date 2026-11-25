import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { fetchStaticIndex } from '@/lib/staticIndex';
import { EXTERNAL_URLS, INDOOR_MAP, QUERY_TIMING_MS } from '@/config/constants';
import { queryKeys } from '@/lib/queryKeys';
import type { IndoorPlan, PlatformsIndex } from '@/types';

const NO_CITIES: PlatformsIndex = { version: 1, cities: {} };

/**
 * The street-level platforms of `city` (tram and train platforms mapped as lines or areas in OpenStreetMap),
 * loaded only once the map is close enough to draw them.
 */
export function usePlatforms(city: string, enabled: boolean) {
    const { data: index } = useQuery<PlatformsIndex>({
        queryKey: queryKeys.platformsIndex(),
        queryFn: ({ signal }) => fetchStaticIndex('platforms/index.json', 1, NO_CITIES, signal),
        enabled,
        staleTime: INDOOR_MAP.INDEX_REFRESH_MS,
        gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
        retry: false,
    });
    const version = index?.cities[city]?.v;
    return useQuery<IndoorPlan>({
        queryKey: queryKeys.platforms(city, version),
        queryFn: ({ signal }) => apiFetch<IndoorPlan>(`${EXTERNAL_URLS.STATIC_DATA}/platforms/${city}.json?v=${version}`, { signal }),
        enabled: enabled && version !== undefined,
        staleTime: QUERY_TIMING_MS.STATIC_METADATA_STALE,
        gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
        retry: false,
    });
}
