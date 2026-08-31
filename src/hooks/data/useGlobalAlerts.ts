import { useQuery } from '@tanstack/react-query';
import type { RSSItem, Infotext } from '../../types/alerts';
import { apiFetch } from '../../lib/api-client';
import { usePreferencesStore } from '../../state/preferencesStore';
import { getCityConfig } from '../../config/cities';

export const useGlobalAlerts = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const cityConfig = getCityConfig(selectedCity);

    const alertsQuery = useQuery<{ alerts: RSSItem[] }>({
        queryKey: ['alerts', selectedCity],
        queryFn: async () => {
            return await apiFetch<{ alerts: RSSItem[] }>(`/${selectedCity}/alerts`);
        },
        enabled: !!selectedCity,
        refetchInterval: 2 * 60 * 1000,
        staleTime: 60 * 1000,
    });

    const infotextsQuery = useQuery<Infotext[]>({
        queryKey: ['infotexts', selectedCity],
        queryFn: async () => {
            return await apiFetch<Infotext[]>(`/${selectedCity}/infotexts`);
        },
        enabled: !!selectedCity && !!cityConfig?.hasInfotexts,
        refetchInterval: 2 * 60 * 1000,
        staleTime: 60 * 1000,
    });

    return {
        rss: { data: alertsQuery.data, isLoading: alertsQuery.isLoading },
        infotexts: { data: infotextsQuery.data, isLoading: infotextsQuery.isLoading },
        isLoading: alertsQuery.isLoading || infotextsQuery.isLoading
    };
};
