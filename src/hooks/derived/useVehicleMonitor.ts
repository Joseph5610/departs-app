import { useMemo } from 'react';
import type { VehicleCollection } from '@/types';
import { monitorVehicles, type MonitorOptions } from '@/domain/vehicles';

interface UseVehicleMonitorProps extends MonitorOptions {
    vehiclesCollection: VehicleCollection | null;
}

export const useVehicleMonitor = ({
    vehiclesCollection,
    searchQuery,
    searchField,
    modeFilter,
    sortBy,
}: UseVehicleMonitorProps) =>
    useMemo(
        () => monitorVehicles(vehiclesCollection, { searchQuery, searchField, modeFilter, sortBy }),
        [vehiclesCollection, searchQuery, searchField, modeFilter, sortBy],
    );
