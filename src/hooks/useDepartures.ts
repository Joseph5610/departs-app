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
        refetchInterval: 10000,
        staleTime: 10000,
    });

    const enrichedData = useMemo(() => {
        if (!query.data?.departures) return query.data;

        return {
            // We use refs for tracking deltas across query refreshes.
            // This is safe because refs are only updated in useEffect.
            departures: query.data.departures.map(dep => {
                const key = `${dep.tripId}-${dep.scheduled}`;
                const prevDelay = prevDelaysRef.current[key];
                const lastUpdate = lastUpdateRef.current[key];
                const delta = (prevDelay !== undefined && prevDelay !== dep.delay) ? dep.delay - prevDelay : 0;

                return {
                    ...dep,
                    delayDelta: delta || undefined,
                    lastDelayUpdate: delta !== 0 ? query.dataUpdatedAt : lastUpdate
                };
            })
        };
    }, [query.data, query.dataUpdatedAt]);

    // Update tracking refs in an effect to maintain render purity.
    useEffect(() => {
        if (query.data?.departures) {
            const now = query.dataUpdatedAt;
            query.data.departures.forEach(dep => {
                const key = `${dep.tripId}-${dep.scheduled}`;
                const prevDelay = prevDelaysRef.current[key];

                if (prevDelay !== undefined && prevDelay !== dep.delay) {
                    lastUpdateRef.current[key] = now;
                }
                prevDelaysRef.current[key] = dep.delay;
            });
        }
    }, [query.data, query.dataUpdatedAt]);

    return { ...query, data: enrichedData };
};
