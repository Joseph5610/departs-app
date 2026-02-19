import { useQuery } from '@tanstack/react-query';
import { useRef, useMemo, useEffect } from 'react';
import type { Departure } from '../types/transit';
import { useMap } from '../hooks/useMap';

export const useDepartures = () => {
    const { state } = useMap();
    const stopId = state.selectedStop?.id || null;
    const prevDelaysRef = useRef<Record<string, number>>({});
    const lastUpdateRef = useRef<Record<string, number>>({});

    const query = useQuery<{ departures: Departure[] }>({
        queryKey: ['departures', stopId],
        queryFn: async () => {
            if (!stopId) return null;
            const res = await fetch(`/api/departures?stopId=${encodeURIComponent(stopId)}`);
            if (!res.ok) throw new Error('Failed to fetch departures');
            return res.json();
        },
        enabled: !!stopId,
        refetchInterval: 10000, // Reduced to 10s for better responsiveness
        staleTime: 10000,
    });

    const departuresWithDeltas = useMemo(() => {
        if (!query.data?.departures) return query.data;

        const nextDepartures = query.data.departures.map(dep => {
            const key = `${dep.tripId}-${dep.scheduled}`;
            const prevDelay = prevDelaysRef.current[key];
            const lastUpdate = lastUpdateRef.current[key];
            let delta = 0;

            if (prevDelay !== undefined && prevDelay !== dep.delay) {
                delta = dep.delay - prevDelay;
            }

            return {
                ...dep,
                delayDelta: delta || undefined,
                lastDelayUpdate: delta !== 0 ? Date.now() : lastUpdate
            };
        });

        return { departures: nextDepartures };
    }, [query.data]);

    // Update refs in useEffect to maintain purity in useMemo/render
    useEffect(() => {
        if (query.data?.departures) {
            const now = Date.now();
            query.data.departures.forEach(dep => {
                const key = `${dep.tripId}-${dep.scheduled}`;
                const prevDelay = prevDelaysRef.current[key];

                if (prevDelay !== undefined && prevDelay !== dep.delay) {
                    lastUpdateRef.current[key] = now;
                }
                prevDelaysRef.current[key] = dep.delay;
            });
        }
    }, [query.data]);

    return { ...query, data: departuresWithDeltas };
};
