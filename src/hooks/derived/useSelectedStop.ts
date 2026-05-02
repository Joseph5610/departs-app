import { useMemo } from 'react';
import { useSelection } from '../../state/MapStateProvider';
import { useStops } from '../data/useStops';
import type { SelectedStop } from '../../types/transit';

/**
 * useSelectedStop
 *
 * A derived data hook that resolves the currently selected stop ID
 * into a full SelectedStop object using the local GeoJSON cache.
 */
export const useSelectedStop = () => {
    const { state } = useSelection();
    const { allFeatures: stopsData } = useStops();
    const stopId = state.selectedStopId;

    return useMemo((): SelectedStop | null => {
        if (!stopId) {
            return null;
        }

        if (!stopsData) {
            return { stop_id: stopId };
        }

        const feature = stopsData.features.find(f => {
            const p = f.properties;
            if (p.stop_id === stopId) return true;

            try {
                const allIds = typeof p.all_ids === 'string' ? JSON.parse(p.all_ids) : p.all_ids;
                return Array.isArray(allIds) && allIds.includes(stopId);
            } catch {
                return false;
            }
        });

        if (!feature) {
            return { stop_id: stopId };
        }

        const p = feature.properties;

        let metro_lines: string[] | undefined = undefined;
        try {
            metro_lines = typeof p.metro_lines === 'string' ? JSON.parse(p.metro_lines) : p.metro_lines;
        } catch { /* ignore */ }

        let all_ids: string[] | undefined = undefined;
        try {
            all_ids = typeof p.all_ids === 'string' ? JSON.parse(p.all_ids) : p.all_ids;
        } catch { /* ignore */ }

        return {
            stop_id: feature.properties.stop_id,
            stop_name: p.stop_name,
            platform_code: p.platform_code,
            all_ids: Array.isArray(all_ids) ? all_ids : undefined,
            is_train: Number(p.is_train) === 1 ? 1 : 0,
            metro_lines: Array.isArray(metro_lines) ? metro_lines : undefined,
            coordinates: feature.geometry.coordinates as [number, number]
        };
    }, [stopId, stopsData]);
};
