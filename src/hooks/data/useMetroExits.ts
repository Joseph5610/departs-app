import { useQuery } from '@tanstack/react-query';
import type { MetroExitsFile } from '@/types';
import { useCityConfig } from './useCities';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '@/config/constants';
import { apiFetch } from '@/lib/apiClient';
import { createDevicePersister, deviceCacheStaleTime } from '@/lib/deviceCache';
import { queryKeys } from '@/lib/queryKeys';

const metroExitsPersister = createDevicePersister(data => data as MetroExitsFile);

/** The metro car nearest to each way out (`<city>/metro_exits.json`), loaded once a metro trip needs it. */
export function useMetroExits(city: string, isNeeded: boolean) {
    const hasMetroExits = Boolean(useCityConfig(city).hasMetroExits);
    return useQuery<MetroExitsFile>({
        queryKey: queryKeys.metroExits(city),
        queryFn: ({ signal }) => apiFetch<MetroExitsFile>(`${EXTERNAL_URLS.STATIC_DATA}/${city}/metro_exits.json`, { signal }),
        enabled: isNeeded && hasMetroExits,
        staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.METRO_EXITS_STALE),
        gcTime: QUERY_TIMING_MS.METRO_EXITS_GC,
        persister: metroExitsPersister,
    });
}
