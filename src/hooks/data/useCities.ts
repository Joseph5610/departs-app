import { useQuery } from '@tanstack/react-query';
import type { AppCitiesResponse } from '../../../functions/_core/types';

export function useCities() {
    return useQuery<AppCitiesResponse, Error>({
        queryKey: ['cities', 'v2'],
        queryFn: async () => {
            const response = await fetch('/api/cities');
            if (!response.ok) {
                throw new Error('Failed to fetch cities configuration');
            }
            return response.json();
        },
        staleTime: 1000 * 60 * 60, // 1 hour
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        refetchOnWindowFocus: false,
    });
}
