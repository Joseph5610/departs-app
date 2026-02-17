import { useQuery } from '@tanstack/react-query';
import type { Departure } from '../types/transit';
import { API_ENDPOINTS, REFRESH_INTERVALS } from '../config/api';

export const useDepartures = (stopId: string | null) => {
    return useQuery<{ departures: Departure[] }>({
        queryKey: ['departures', stopId],
        queryFn: async () => {
            if (!stopId) return null;
            const res = await fetch(`${API_ENDPOINTS.DEPARTURES}?stopId=${encodeURIComponent(stopId)}`);
            if (!res.ok) throw new Error('Failed to fetch departures');
            return res.json();
        },
        enabled: !!stopId,
        refetchInterval: REFRESH_INTERVALS.DEPARTURES,
        staleTime: REFRESH_INTERVALS.DEPARTURES,
    });
};
