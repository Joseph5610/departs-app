import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { EXTERNAL_URLS, INDOOR_MAP, QUERY_TIMING_MS } from '@/config/constants';
import { queryKeys } from '@/lib/queryKeys';
import type { IndoorPlan, PlatformsIndex } from '@/types';

/**
 * The street-level platforms of `city` (tram and train platforms mapped as lines or areas in OpenStreetMap),
 * loaded only once the map is close enough to draw them.
 */
export function usePlatforms(city: string, enabled: boolean) {
    const { data: index } = useQuery<PlatformsIndex>({
        queryKey: queryKeys.platformsIndex(),
        queryFn: ({ signal }) => apiFetch<PlatformsIndex>(`${EXTERNAL_URLS.STATIC_DATA}/platforms/index.json?h=${Math.floor(Date.now() / INDOOR_MAP.INDEX_REFRESH_MS)}`, { signal }),
        enabled,
        staleTime: INDOOR_MAP.INDEX_REFRESH_MS,
        gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
        retry: false,
    });
    const version = index?.version === 1 ? index.cities[city]?.v : undefined;
    return useQuery<IndoorPlan>({
        queryKey: queryKeys.platforms(city, version),
        queryFn: ({ signal }) => apiFetch<IndoorPlan>(`${EXTERNAL_URLS.STATIC_DATA}/platforms/${city}.json?v=${version}`, { signal }),
        enabled: enabled && version !== undefined,
        staleTime: QUERY_TIMING_MS.STATIC_METADATA_STALE,
        gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
        retry: false,
    });
}
