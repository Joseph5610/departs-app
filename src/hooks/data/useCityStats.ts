import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useRouteParams } from '../useRouteParams';
import { TRANSIT_REFRESH_MS } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';
import type { AppError } from '../../types/error';
import type { AppCityStats } from '../../../functions/_core/types';

const fetchCityStats = (selectedCity: string): Promise<AppCityStats> =>
    apiFetch<AppCityStats>(`/${selectedCity}/stats`);

export const useCityStats = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { isStatsRoute } = useRouteParams();

    return useQuery<AppCityStats, AppError>({
        queryKey: ['cityStats', selectedCity],
        queryFn: () => fetchCityStats(selectedCity),
        enabled: !!selectedCity && isStatsRoute,
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: 5000,
        gcTime: 60000,
    });
};
