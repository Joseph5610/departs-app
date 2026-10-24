import '@/lib/zodConfig';
import { z } from 'zod/mini';
import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useCityConfig } from './useCities';
import { apiFetch } from '@/lib/apiClient';
import { DEVICE_CACHE, EXTERNAL_URLS, QUERY_TIMING_MS } from '@/config/constants';
import { createDevicePersister, deviceCacheStaleTime } from '@/lib/deviceCache';
import { queryKeys } from '@/lib/queryKeys';
import type { NetworkLineCollection } from '@/types';

/** Checks only the collection's shape; departs-data validates every feature before publishing it. */
const networkLinesSchema = z.looseObject({
    type: z.literal('FeatureCollection'),
    features: z.array(z.unknown()),
});

const networkLinesPersister = createDevicePersister((data): NetworkLineCollection => {
    networkLinesSchema.parse(data);
    return data as NetworkLineCollection;
});

/** The selected city's backbone lines from the static data CDN for cities with `hasNetworkLines`, kept on the device (IndexedDB) across launches. */
export function useNetworkLines(): NetworkLineCollection | null {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const hasNetworkLines = Boolean(useCityConfig().hasNetworkLines);
    const show = usePreferencesStore(s => s.showNetworkLines);

    const { data } = useQuery({
        queryKey: queryKeys.networkLines(selectedCity),
        queryFn: ({ signal }) => apiFetch<NetworkLineCollection>(`${EXTERNAL_URLS.STATIC_DATA}/${selectedCity}/network.json?v=${DEVICE_CACHE.VERSION}`, { signal }),
        enabled: hasNetworkLines && show,
        staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.STATIC_METADATA_STALE),
        gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
        persister: networkLinesPersister,
    });

    return hasNetworkLines ? data ?? null : null;
}
