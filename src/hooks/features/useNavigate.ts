import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelectedStop } from '../derived/useSelectedStop';
import { useStopDistance } from '../derived/useStopDistance';

/**
 * useNavigate
 *
 * Provides navigation functionality and formatted distance labels
 * for the selected stop. Handles platform-specific deep links.
 */
export const useNavigate = () => {
    const { t } = useTranslation();
    const selectedStop = useSelectedStop();
    const stopDistanceInfo = useStopDistance();

    const handleNavigate = useCallback(() => {
        if (!selectedStop?.coordinates) return;

        const [lon, lat] = selectedStop.coordinates;
        const name = encodeURIComponent(selectedStop.stop_name || '');
        const isAppleDevice = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

        if (isAppleDevice) {
            // Apple Maps - use location.href to avoid blank tabs for deep links
            window.location.href = `maps://?q=${name}&ll=${lat},${lon}`;
        } else {
            // Google Maps
            window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}${name ? `&query_place_id=${name}` : ''}`, '_blank');
        }
    }, [selectedStop]);

    const distanceLabel = useMemo(() => {
        if (!stopDistanceInfo) return t('map.departures.navigate');
        if (stopDistanceInfo.isAtStop) return t('map.departures.atStop');

        const { distance, time, isReasonableWalkingDistance } = stopDistanceInfo;

        if (isReasonableWalkingDistance) {
            return t('map.departures.distance', {
                distance,
                count: time
            });
        }

        if (distance >= 1000) {
            return t('map.departures.kilometers', {
                distance: (distance / 1000).toFixed(1)
            });
        }

        return t('map.departures.meters', {
            distance
        });
    }, [stopDistanceInfo, t]);

    return {
        handleNavigate,
        distanceLabel
    };
};
