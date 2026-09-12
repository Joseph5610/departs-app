import { useQuery } from '@tanstack/react-query';
import type { AppCitiesResponse } from '../../../functions/_core/types';
import { apiFetch } from '@/lib/api-client';
import { QUERY_TIMING_MS } from '../../config/constants';

export function useCities() {
    return useQuery<AppCitiesResponse, Error>({
        queryKey: ['cities', 'v2'],
        queryFn: () => apiFetch<AppCitiesResponse>('/cities'),
        staleTime: QUERY_TIMING_MS.CITIES_STALE,
        gcTime: QUERY_TIMING_MS.CITIES_GC,
        refetchOnWindowFocus: false,
    });
}
