import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { useGeolocationStore } from '@/state/geolocationStore';
import { getStopDistanceInfo, type StopDistanceInfo } from '@/domain/stops';

/** "At the stop", walking distance with minutes when nearby, otherwise the plain distance. */
/** The distance to a stop as the board shows it, with decimals in `locale`'s style ("1,3 km" in Czech). */
export const formatStopDistance = (info: StopDistanceInfo, t: TFunction, locale?: string): string => {
    if (info.isAtStop) return t('map.departures.atStop');
    if (info.isReasonableWalkingDistance) return t('map.departures.distance', { distance: info.distance, count: info.time });
    if (info.distance >= 1000) {
        const km = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(info.distance / 1000);
        return t('map.departures.kilometers', { distance: km });
    }
    return t('map.departures.meters', { distance: info.distance });
};

/**
 * Calculates the current distance and walking time from the user's location
 * to `coordinates`, and whether the user is already there.
 */
export const useStopDistance = (coordinates: [number, number] | undefined): StopDistanceInfo | null => {
    const userLocation = useGeolocationStore(s => s.userLocation);

    return useMemo(
        () => getStopDistanceInfo(userLocation, coordinates),
        [coordinates, userLocation]
    );
};
