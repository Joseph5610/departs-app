import { useQuery } from '@tanstack/react-query';
import type { RSSResponse, Infotext } from '../../types/transit';

/**
 * useGlobalAlerts
 *
 * Central hook for fetching global transit alerts (RSS incidents/exclusions
 * and stop-specific infotexts).
 */
export const useGlobalAlerts = () => {
    /** RSS Alerts (Incidents and Exclusions) */
    const rss = useQuery<RSSResponse>({
        queryKey: ['rss'],
        queryFn: async () => {
            const res = await fetch('/api/rss');
            if (!res.ok) {
                throw new Error(`Failed to fetch RSS: ${res.statusText}`);
            }
            return res.json();
        },
        refetchInterval: 5 * 60 * 1000,
        staleTime: 5 * 60 * 1000,
    });

    /** Stop-specific Infotexts */
    const infotexts = useQuery<Infotext[]>({
        queryKey: ['infotexts'],
        queryFn: async () => {
            const res = await fetch('/api/infotexts');
            if (!res.ok) {
                throw new Error('Failed to fetch infotexts');
            }
            return res.json();
        },
        refetchInterval: 15 * 60 * 1000,
        staleTime: 15 * 60 * 1000,
    });

    return {
        rss,
        infotexts,
        isLoading: rss.isLoading || infotexts.isLoading
    };
};
