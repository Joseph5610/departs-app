import { useQuery } from '@tanstack/react-query';
import type { AppCitiesResponse } from '../../../functions/_core/types';
import { apiFetch } from '@/lib/api-client';

export function useCities() {
    return useQuery<AppCitiesResponse, Error>({
        queryKey: ['cities', 'v2'],
        queryFn: () => apiFetch<AppCitiesResponse>('/cities'),
        staleTime: 1000 * 60 * 60, // 1 hour
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        refetchOnWindowFocus: false,
    });
}
