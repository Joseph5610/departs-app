import { useQuery } from '@tanstack/react-query';
import { useMap } from '../hooks/useMap';

export const useParking = () => {
    const { state } = useMap();
    const { showParking } = state;

    const query = useQuery({
        queryKey: ['parking'],
        queryFn: async () => {
            const response = await fetch('/api/parking');
            if (!response.ok) throw new Error('Failed to fetch parking');
            return response.json();
        },
        enabled: showParking,
        refetchInterval: 60000, // 1 minute
        staleTime: 30000,
    });

    return {
        data: query.data,
        isLoading: query.isLoading,
        error: query.error
    };
};
