
import { useQuery } from '@tanstack/react-query';
import type { RSSResponse } from '../types/transit';

const fetchRSS = async (): Promise<RSSResponse> => {
    const res = await fetch('/api/rss');
    if (!res.ok) throw new Error(`Failed to fetch RSS: ${res.statusText}`);
    return await res.json();
};

export const useRSS = () => {
    return useQuery({
        queryKey: ['rss'],
        queryFn: fetchRSS,
        refetchInterval: 5 * 60 * 1000,
        staleTime: 5 * 60 * 1000,
    });
};
