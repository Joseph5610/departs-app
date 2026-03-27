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
        const isAppleDevice = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

        if (isAppleDevice) {
            // Apple Maps - Directions to address with walking mode
            window.location.href = `maps://?daddr=${lat},${lon}&dirflg=w`;
        } else {
            // Google Maps - Directions to destination with walking mode
            // Use location.href for deep links to avoid unnecessary blank tabs
            window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
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
