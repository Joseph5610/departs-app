import { useQuery } from '@tanstack/react-query';
import { useMap } from '../hooks/useMap';

export const useSharedCars = () => {
    const { state } = useMap();
    const { showSharedCars } = state;

    const query = useQuery({
        queryKey: ['shared-cars'],
        queryFn: async () => {
            const response = await fetch('/api/shared-cars');
            if (!response.ok) throw new Error('Failed to fetch shared cars');
            return response.json();
        },
        enabled: showSharedCars,
        refetchInterval: 30000, // 30 seconds
        staleTime: 15000,
    });

    return {
        data: query.data,
        isLoading: query.isLoading,
        error: query.error
    };
};
