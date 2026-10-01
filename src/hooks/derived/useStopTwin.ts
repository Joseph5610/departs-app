import { useMemo } from 'react';
import type { StopCollection } from '../../types/transit';
import { useOverlayNetworks } from '../data/useOverlayNetworks';
import { useNetworksInView } from './useNetworksInView';
import { useSelectedStop } from './useSelectedStop';
import { indexStops, stopNameKey, stopNear } from '../../lib/sharedGround';
import { memoizeLast } from '../../lib/memoize';
import { SHARED_GROUND } from '../../config/constants';

export interface StopTwin {
    city: string;
    stopId: string;
}

const platformGrid = memoizeLast((stops: StopCollection | null) => indexStops(stops, SHARED_GROUND.TWIN_STOP_RADIUS_M));
const stationGrid = memoizeLast((stations: StopCollection | null) => indexStops(stations, SHARED_GROUND.TWIN_STATION_RADIUS_M));

/**
 * useStopTwin
 *
 * The same place in another network shown on the map: its platform where one stands on the selected
 * stop, else its station of the same name nearby. The map draws only the selected network's stop there.
 */
export const useStopTwin = (): StopTwin | null => {
    const stop = useSelectedStop();
    const { stops, centroids } = useOverlayNetworks(useNetworksInView());

    return useMemo(() => {
        const point = stop?.coordinates;
        if (!point) return null;
        const twin = stopNear(platformGrid(stops), point)
            ?? stopNear(stationGrid(centroids), point, stopNameKey(stop.stop_name));
        const city = twin?.properties.city_slug;
        return twin && city ? { city, stopId: twin.properties.stop_id } : null;
    }, [stop, stops, centroids]);
};
