import { useMemo } from 'react';
import type { StopModel } from '@/types';
import { useOverlayNetworks } from '@/hooks/data/useOverlayNetworks';
import { useNetworksInView } from './useNetworksInView';
import { useSelectedStop } from './useSelectedStop';
import { indexStops, stopNameKey, stopNear } from '@/domain/stops';
import { memoizeLast } from '@/lib/memoize';
import { SHARED_GROUND } from '@/config/constants';

export interface StopTwin {
    city: string;
    stopId: string;
}

const platformGrid = memoizeLast((networks: readonly StopModel[]) =>
    indexStops(networks.flatMap(n => n.platforms.filter(p => !p.alightOnly)), SHARED_GROUND.TWIN_STOP_RADIUS_M));
const stationGrid = memoizeLast((networks: readonly StopModel[]) =>
    indexStops(networks.flatMap(n => n.stations.filter(s => !s.alightOnly)), SHARED_GROUND.TWIN_STATION_RADIUS_M));

/**
 * The same place in another network shown on the map: its platform where one stands on the selected
 * stop, else its station of the same name nearby. The map draws only the selected network's stop there.
 */
export const useStopTwin = (): StopTwin | null => {
    const stop = useSelectedStop();
    const networks = useNetworksInView();
    const overlay = useOverlayNetworks(networks).networks;

    return useMemo(() => {
        if (!stop?.board) return null;
        const { pos, name } = stop.board;
        const twin = stopNear(platformGrid(overlay), pos) ?? stopNear(stationGrid(overlay), pos, stopNameKey(name));
        return twin?.city ? { city: twin.city, stopId: twin.id } : null;
    }, [stop, overlay]);
};
