import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useRouteParams } from '../useRouteParams';
import { TRANSIT_REFRESH_MS, LIVE_FETCH_OPTIONS, QUERY_TIMING_MS } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';
import type { AppError } from '../../types/error';
import type { CityStats } from '../../types/transit';

const fetchCityStats = (selectedCity: string): Promise<CityStats> =>
    apiFetch<CityStats>(`/${selectedCity}/stats`, LIVE_FETCH_OPTIONS);

export const useCityStats = (enabled = true) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { isStatsRoute } = useRouteParams();

    return useQuery<CityStats, AppError>({
        queryKey: ['cityStats', selectedCity],
        queryFn: () => fetchCityStats(selectedCity),
        enabled: enabled && !!selectedCity && isStatsRoute,
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: QUERY_TIMING_MS.LIVE_STALE,
        gcTime: QUERY_TIMING_MS.LIVE_GC,
    });
};
