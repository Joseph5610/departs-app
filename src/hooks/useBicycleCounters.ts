import { useQuery } from '@tanstack/react-query';
import { useMap } from '../hooks/useMap';

export const useBicycleCounters = () => {
    const { state } = useMap();
    const { showBicycleCounters } = state;

    const query = useQuery({
        queryKey: ['bicycle-counters'],
        queryFn: async () => {
            const response = await fetch('/api/bicycle-counters');
            if (!response.ok) throw new Error('Failed to fetch bicycle counters');
            return response.json();
        },
        enabled: showBicycleCounters,
        refetchInterval: 600000, // 10 minutes
        staleTime: 300000,
    });

    return {
        data: query.data,
        isLoading: query.isLoading,
        error: query.error
    };
};
