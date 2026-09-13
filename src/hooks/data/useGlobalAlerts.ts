import { useQuery } from '@tanstack/react-query';
import type { RSSItem, Infotext } from '../../types/alerts';
import { apiFetch } from '../../lib/api-client';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useCityConfig } from './useCities';
import { QUERY_TIMING_MS } from '../../config/constants';

export const useGlobalAlerts = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const cityConfig = useCityConfig();
    const hasAlerts = Boolean(cityConfig.hasAlerts);

    const alertsQuery = useQuery<{ alerts: RSSItem[] }>({
        queryKey: ['alerts', selectedCity],
        queryFn: async () => {
            return await apiFetch<{ alerts: RSSItem[] }>(`/${selectedCity}/alerts`);
        },
        enabled: !!selectedCity && hasAlerts,
        refetchInterval: QUERY_TIMING_MS.ALERTS_REFRESH,
        staleTime: QUERY_TIMING_MS.NOTICES_STALE,
    });

    const infotextsQuery = useQuery<Infotext[]>({
        queryKey: ['infotexts', selectedCity],
        queryFn: async () => {
            return await apiFetch<Infotext[]>(`/${selectedCity}/infotexts`);
        },
        enabled: !!selectedCity && !!cityConfig.hasInfotexts,
        refetchInterval: QUERY_TIMING_MS.INFOTEXTS_REFRESH,
        staleTime: QUERY_TIMING_MS.NOTICES_STALE,
    });

    return {
        hasAlerts,
        rss: { data: alertsQuery.data, isLoading: alertsQuery.isLoading },
        infotexts: { data: infotextsQuery.data, isLoading: infotextsQuery.isLoading },
        isLoading: alertsQuery.isLoading || infotextsQuery.isLoading
    };
};
