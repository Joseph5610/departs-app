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
        const suffix = t('map.departures.openInMaps');
        if (!stopDistanceInfo) return suffix;
        if (stopDistanceInfo.isAtStop) return t('map.departures.atStop');

        const { distance, time, isReasonableWalkingDistance } = stopDistanceInfo;

        if (isReasonableWalkingDistance) {
            // Keep it compact for nearby stops to leave room for other metrics
            return t('map.departures.distance', {
                distance,
                count: time
            });
        }

        // For longer distances where we don't show walking time, add the suffix back
        if (distance >= 1000) {
            return `${t('map.departures.kilometers', {
                distance: (distance / 1000).toFixed(1)
            })} • ${suffix}`;
        }

        return `${t('map.departures.meters', {
            distance
        })} • ${suffix}`;
    }, [stopDistanceInfo, t]);

    return {
        handleNavigate,
        distanceLabel,
        stopDistanceInfo
    };
};
