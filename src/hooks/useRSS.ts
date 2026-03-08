
import { useQuery } from '@tanstack/react-query';
import { RSSResponse } from '../types/transit';

const fetchRSS = async (): Promise<RSSResponse> => {
    const res = await fetch('/api/rss');
    if (!res.ok) throw new Error(`Failed to fetch RSS: ${res.statusText}`);
    return await res.json();
};

export const useRSS = () => {
    return useQuery({
        queryKey: ['rss'],
        queryFn: fetchRSS,
        refetchInterval: 5 * 60 * 1000, // 5 minutes
        staleTime: 5 * 60 * 1000,
    });
};
