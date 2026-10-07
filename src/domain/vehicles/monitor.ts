import type { VehicleCollection, VehicleProperties } from '@/types';

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

type MonitorSort = 'line' | 'delay' | 'registration';

export interface MonitorOptions {
    searchQuery: string;
    searchField?: SearchField;
    modeFilter: string;
    sortBy?: MonitorSort;
}

const toItem = (p: VehicleProperties): EnrichedVehicleItem => {
    const vehicleId = p.vehicle_id || undefined;
    return {
        id: vehicleId && p.gtfs_trip_id ? `${vehicleId}-${p.gtfs_trip_id}` : (vehicleId || p.gtfs_trip_id || `${p.route_short_name}_${p.bearing}`),
        vehicleId,
        gtfsTripId: p.gtfs_trip_id || '',
        line: String(p.route_short_name || ''),
        routeType: p.route_type,
        routeColor: p.route_color || '',
        delay: typeof p.delay === 'number' ? p.delay : null,
    };
};

/** Line numbers numerically where both are numbers ("9" before "22"), otherwise naturally. */
const byLine = (a: EnrichedVehicleItem, b: EnrichedVehicleItem) => {
    const lineA = parseInt(a.line, 10);
    const lineB = parseInt(b.line, 10);
    if (!isNaN(lineA) && !isNaN(lineB) && lineA !== lineB) return lineA - lineB;
    return a.line.localeCompare(b.line, undefined, { numeric: true });
};

const COMPARATORS: Record<MonitorSort, (a: EnrichedVehicleItem, b: EnrichedVehicleItem) => number> = {
    line: byLine,
    delay: (a, b) => (b.delay || 0) - (a.delay || 0),
    registration: (a, b) => (a.vehicleId || '').localeCompare(b.vehicleId || ''),
};

/** The fleet as list rows, filtered by mode and search and sorted; `totalCount` and `modeCounts` cover the whole fleet. */
export const monitorVehicles = (
    vehiclesCollection: VehicleCollection | null,
    { searchQuery, searchField = 'line', modeFilter, sortBy = 'line' }: MonitorOptions,
) => {
    const modeCounts: Record<string, number> = {};
    const items = (vehiclesCollection?.features ?? []).map(({ properties }) => {
        modeCounts[properties.route_type] = (modeCounts[properties.route_type] || 0) + 1;
        return toItem(properties);
    });

    const q = searchQuery.trim().toLowerCase();
    const matches = (item: EnrichedVehicleItem) =>
        searchField === 'vehicle' ? !!item.vehicleId?.toLowerCase().includes(q) : item.line.toLowerCase().includes(q);
    const shown = items.filter(item => (modeFilter === 'all' || item.routeType === modeFilter) && (!q || matches(item)));

    return { items: shown.sort(COMPARATORS[sortBy]), totalCount: items.length, modeCounts };
};
