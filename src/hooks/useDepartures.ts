import { useQuery } from '@tanstack/react-query';
import type { Departure } from '../types/transit';

export const useDepartures = (stopId: string | null) => {
    return useQuery<{ departures: Departure[] }>({
        queryKey: ['departures', stopId],
        queryFn: async () => {
            if (!stopId) return null;
            const res = await fetch(`/api/departures?stopId=${encodeURIComponent(stopId)}`);
            if (!res.ok) throw new Error('Failed to fetch departures');
            return res.json();
        },
        enabled: !!stopId,
        refetchInterval: 20000,
        staleTime: 20000,
    });
};
