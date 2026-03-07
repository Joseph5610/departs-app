import { useQuery } from '@tanstack/react-query';
import { useMap } from '../hooks/useMap';

export const useAirQuality = () => {
    const { state } = useMap();
    const { showAirQuality } = state;

    const query = useQuery({
        queryKey: ['air-quality'],
        queryFn: async () => {
            const response = await fetch('/api/air-quality');
            if (!response.ok) throw new Error('Failed to fetch air quality');
            return response.json();
        },
        enabled: showAirQuality,
        refetchInterval: 300000, // 5 minutes
        staleTime: 60000,
    });

    return {
        data: query.data,
        isLoading: query.isLoading,
        error: query.error
    };
};
