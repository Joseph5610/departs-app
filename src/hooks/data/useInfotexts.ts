import { useQuery } from '@tanstack/react-query';
import type { Infotext } from '@/types';
import { apiFetch } from '@/lib/apiClient';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useCityConfig } from './useCities';
import { QUERY_TIMING_MS } from '@/config/constants';
import { queryKeys } from '@/lib/queryKeys';

/** The selected city's stop notices (PID infotexts); undefined for a city without them. */
export const useInfotexts = (): Infotext[] | undefined => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const cityConfig = useCityConfig();
    const hasInfotexts = Boolean(cityConfig.hasInfotexts);

    const { data } = useQuery<Infotext[]>({
        queryKey: queryKeys.infotexts(selectedCity),
        queryFn: () => apiFetch<Infotext[]>(`/${selectedCity}/infotexts`),
        enabled: !!selectedCity && hasInfotexts,
        refetchInterval: QUERY_TIMING_MS.INFOTEXTS_REFRESH,
        staleTime: QUERY_TIMING_MS.NOTICES_STALE,
        retry: false,
    });
    return data;
};
