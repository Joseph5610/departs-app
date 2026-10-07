import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { useGeolocationStore } from '@/state/geolocationStore';
import { useSelectedStop } from './useSelectedStop';
import { getStopDistanceInfo, type StopDistanceInfo } from '@/domain/stops';

/** "At the stop", walking distance with minutes when nearby, otherwise the plain distance. */
export const formatStopDistance = (info: StopDistanceInfo, t: TFunction): string => {
    if (info.isAtStop) return t('map.departures.atStop');
    if (info.isReasonableWalkingDistance) return t('map.departures.distance', { distance: info.distance, count: info.time });
    if (info.distance >= 1000) return t('map.departures.kilometers', { distance: (info.distance / 1000).toFixed(1) });
    return t('map.departures.meters', { distance: info.distance });
};

/**
 * Calculates the current distance and walking time from the user's location 
 * to the selected stop. Also determines if the user is currently at the stop 
 * or if they should see an indicator for "catching" the departure.
 */
export const useStopDistance = (): StopDistanceInfo | null => {
    const selectedStop = useSelectedStop();
    const userLocation = useGeolocationStore(s => s.userLocation);

    return useMemo(
        () => getStopDistanceInfo(userLocation, selectedStop?.coordinates),
        [selectedStop?.coordinates, userLocation]
    );
};
