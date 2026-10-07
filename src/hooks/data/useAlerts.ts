import { useQuery } from '@tanstack/react-query';
import type { RSSItem } from '@/types';
import { apiFetch } from '@/lib/apiClient';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useCityConfig } from './useCities';
import { useRouteMetadata } from './useRouteMetadata';
import { QUERY_TIMING_MS } from '@/config/constants';
import { enrichAlertLineMetadata, withAlertTiming } from '@/domain/alerts';
import { memoizeLast } from '@/lib/memoize';
import { queryKeys } from '@/lib/queryKeys';

const brandAlerts = memoizeLast(enrichAlertLineMetadata);
const timeAlerts = memoizeLast(withAlertTiming);
const NO_ALERTS: RSSItem[] = [];

/** The selected city's service alerts, timed and branded with its lines; `hasAlerts` is false for a city without a feed. */
export const useAlerts = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const cityConfig = useCityConfig();
    const hasAlerts = Boolean(cityConfig.hasAlerts);
    const { byId, byName, byKordisNumeric } = useRouteMetadata();

    const { data, dataUpdatedAt, isLoading } = useQuery<{ alerts: RSSItem[] }>({
        queryKey: queryKeys.alerts(selectedCity),
        queryFn: () => apiFetch<{ alerts: RSSItem[] }>(`/${selectedCity}/alerts`),
        enabled: !!selectedCity && hasAlerts,
        refetchInterval: QUERY_TIMING_MS.ALERTS_REFRESH,
        staleTime: QUERY_TIMING_MS.NOTICES_STALE,
        retry: false,
    });

    const alerts = data ? brandAlerts(timeAlerts(data.alerts ?? NO_ALERTS, dataUpdatedAt), byId, byName, byKordisNumeric) : undefined;
    return { alerts, isLoading, hasAlerts };
};
