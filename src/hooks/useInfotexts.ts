
import { useQuery } from '@tanstack/react-query';
import type { Infotext } from '../types/transit';

const fetchInfotexts = async (): Promise<Infotext[]> => {
    const res = await fetch('/api/infotexts');
    if (!res.ok) throw new Error('Failed to fetch infotexts');
    return res.json();
};

export const useInfotexts = () => {
    return useQuery<Infotext[]>({
        queryKey: ['infotexts'],
        queryFn: fetchInfotexts,
        refetchInterval: 15 * 60 * 1000,
        staleTime: 15 * 60 * 1000,
    });
};
