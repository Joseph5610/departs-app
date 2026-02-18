import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS } from '../config/api';

/**
 * Hook for RSS feeds (incidents/exclusions) from Golemio.
 * Provides real-time transit alerts and planned exclusions.
 *
 * @param type - The type of RSS feed to fetch ('incidents' or 'exclusions').
 */
export const useRSS = (type: 'incidents' | 'exclusions') => {
    return useQuery({
        queryKey: ['rss', type],
        queryFn: async () => {
            const res = await fetch(`${API_ENDPOINTS.RSS}?type=${type}`);
            if (!res.ok) throw new Error('Failed to fetch RSS feed');
            const data = await res.json();
            return data;
        },
        // Incidents are refreshed more frequently than planned exclusions
        refetchInterval: type === 'incidents' ? 5 * 60 * 1000 : 60 * 60 * 1000,
        staleTime: type === 'incidents' ? 5 * 60 * 1000 : 60 * 60 * 1000,
    });
};
