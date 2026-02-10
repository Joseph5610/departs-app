
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { VehicleCollection } from '../types/pid';

// 1. Fetcher now returns raw feature arrays (deduplication happens in select)
const fetchRawVehicles = async (bounds: string | null, trackedId: string | null): Promise<any[]> => {
    try {
        let url = '';

        // COMBINED REQUEST: If we have both, send them together to the new backend handler
        if (bounds && trackedId) {
            url = `/api/vehicles?bounds=${bounds}&tripId=${trackedId}`;
        }
        else if (bounds) {
            url = `/api/vehicles?bounds=${bounds}`;
        }
        else if (trackedId) {
            url = `/api/vehicles?tripId=${trackedId}`;
        }

        if (!url) return [];

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const json = await response.json();
        return json.features || [];
    } catch (e) {
        console.error("Error fetching vehicles:", e);
        return [];
    }
};

export const useVehicles = (bounds: string | null, trackedId: string | null = null) => {
    // 2. Select function to transform and deduplicate data
    // Use useCallback to ensure the function reference is stable
    const selectFn = useCallback((allFeatures: any[]): VehicleCollection => {
        const seen = new Set<string>();
        const uniqueFeatures = [];
        for (const f of allFeatures) {
            const id = String(f.properties.vehicle_id || f.properties.id || '');
            if (id && !seen.has(id)) {
                seen.add(id);
                uniqueFeatures.push(f);
            }
        }

        // JITTERING LOGIC: Move from UI render loop to data layer
        const groups: Record<string, any[]> = {};
        uniqueFeatures.forEach((f: any) => {
            const key = f.geometry.coordinates.join(',');
            if (!groups[key]) groups[key] = [];
            groups[key].push(f);
        });

        const jitteredFeatures: any[] = [];
        const BASE_JITTER_RADIUS = 0.00012;

        Object.values(groups).forEach(group => {
            if (group.length === 1) {
                jitteredFeatures.push(group[0]);
            } else {
                const count = group.length;
                const angleStep = (2 * Math.PI) / count;

                group.forEach((f, index) => {
                    const [lng, lat] = f.geometry.coordinates;
                    const angle = index * angleStep;
                    let currentRadius = BASE_JITTER_RADIUS;
                    if (count > 4) {
                        currentRadius = index % 2 === 0 ? BASE_JITTER_RADIUS * 0.8 : BASE_JITTER_RADIUS * 1.35;
                    }

                    jitteredFeatures.push({
                        ...f,
                        geometry: {
                            ...f.geometry,
                            coordinates: [
                                lng + currentRadius * Math.cos(angle) * 1.3,
                                lat + currentRadius * Math.sin(angle)
                            ]
                        }
                    });
                });
            }
        });

        return {
            type: 'FeatureCollection',
            features: jitteredFeatures as any
        };
    }, []);

    return useQuery({
        queryKey: ['vehicles', bounds, trackedId],
        queryFn: () => fetchRawVehicles(bounds, trackedId),
        select: selectFn,
        enabled: !!bounds || !!trackedId,
        refetchInterval: 10000,
        staleTime: 5000,
        gcTime: 60000,
        placeholderData: keepPreviousData,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
};
