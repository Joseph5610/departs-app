import { useQuery } from '@tanstack/react-query';
import type { Departure } from '../types/transit';
import { API_ENDPOINTS } from '../config/api';

export const useDepartures = (stopId: string | null) => {
    return useQuery<{ departures: Departure[] }>({
        queryKey: ['departures', stopId],
        queryFn: async () => {
            if (!stopId) return null;
            const res = await fetch(API_ENDPOINTS.DEPARTURES(stopId));
            if (!res.ok) throw new Error('Failed to fetch departures');
            return res.json();
        },
        enabled: !!stopId,
        refetchInterval: 20000,
        staleTime: 20000,
    });
};
