import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useCityConfig } from './useCities';
import { apiFetch } from '@/lib/apiClient';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '@/config/constants';
import { queryKeys } from '@/lib/queryKeys';
import type { NetworkLineCollection } from '@/types';

/** The selected city's backbone lines, read straight from the static data CDN for cities with `hasNetworkLines`. */
export function useNetworkLines(): NetworkLineCollection | null {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const hasNetworkLines = Boolean(useCityConfig().hasNetworkLines);
    const show = usePreferencesStore(s => s.showNetworkLines);

    const { data } = useQuery({
        queryKey: queryKeys.networkLines(selectedCity),
        queryFn: ({ signal }) => apiFetch<NetworkLineCollection>(`${EXTERNAL_URLS.STATIC_DATA}/${selectedCity}/network.json`, { signal }),
        enabled: hasNetworkLines && show,
        staleTime: QUERY_TIMING_MS.STATIC_METADATA_STALE,
        gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
    });

    return hasNetworkLines ? data ?? null : null;
}
