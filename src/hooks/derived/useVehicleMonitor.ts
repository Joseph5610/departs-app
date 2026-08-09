import { useMemo } from 'react';
import type { VehicleProperties, VehicleCollection } from '../../types/transit';

export interface EnrichedVehicleItem {
    id: string;
    vehicleId?: string;
    gtfsTripId?: string;
    line: string;
    routeType: string;
    routeColor: string;
    delay: number | null;
}

export type SearchField = 'line' | 'vehicle';

interface UseVehicleMonitorProps {
    vehiclesCollection: VehicleCollection | null;
    searchQuery: string;
    searchField?: SearchField;
    modeFilter: string;
    sortBy?: 'line' | 'delay' | 'registration';
}

export const useVehicleMonitor = ({
    vehiclesCollection,
    searchQuery,
    searchField = 'line',
    modeFilter,
    sortBy = 'line'
}: UseVehicleMonitorProps) => {
    return useMemo(() => {
        if (!vehiclesCollection?.features || vehiclesCollection.features.length === 0) {
            return {
                items: [] as EnrichedVehicleItem[],
                totalCount: 0,
                modeCounts: {} as Record<string, number>
            };
        }

        const rawFeatures = vehiclesCollection.features;
        const enrichedItems: EnrichedVehicleItem[] = [];
        const modeCounts: Record<string, number> = {};

        for (const feature of rawFeatures) {
            const p = feature.properties as VehicleProperties;
            const vId = p.vehicle_id || p.vehicle_descriptor?.vehicle_registration_number?.toString() || undefined;
            const slug = p.route_type;

            modeCounts[slug] = (modeCounts[slug] || 0) + 1;

            const itemId = vId && p.gtfs_trip_id ? `${vId}-${p.gtfs_trip_id}` : (vId || p.gtfs_trip_id || `${p.route_short_name}_${p.bearing}`);

            const item: EnrichedVehicleItem = {
                id: itemId,
                vehicleId: vId,
                gtfsTripId: p.gtfs_trip_id || '',
                line: String(p.route_short_name || ''),
                routeType: slug,
                routeColor: p.route_color || '',
                delay: typeof p.delay === 'number' ? p.delay : null
            };

            enrichedItems.push(item);
        }

        // Filter by Mode
        let filtered = enrichedItems;
        if (modeFilter !== 'all') {
            filtered = filtered.filter(item => item.routeType === modeFilter);
        }

        // Filter by Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            filtered = filtered.filter(item => {
                if (searchField === 'vehicle') {
                    return item.vehicleId ? item.vehicleId.toLowerCase().includes(q) : false;
                }
                return item.line.toLowerCase().includes(q);
            });
        }

        // Sort
        filtered.sort((a, b) => {
            if (sortBy === 'line') {
                const lineA = parseInt(a.line, 10);
                const lineB = parseInt(b.line, 10);
                if (!isNaN(lineA) && !isNaN(lineB)) {
                    if (lineA !== lineB) return lineA - lineB;
                }
                return a.line.localeCompare(b.line, undefined, { numeric: true });
            }
            if (sortBy === 'delay') {
                return (b.delay || 0) - (a.delay || 0);
            }
            return (a.vehicleId || '').localeCompare(b.vehicleId || '');
        });

        return {
            items: filtered,
            totalCount: enrichedItems.length,
            modeCounts
        };
    }, [vehiclesCollection, searchQuery, searchField, modeFilter, sortBy]);
};
