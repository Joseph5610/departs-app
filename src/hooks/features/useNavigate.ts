import { useCallback } from 'react';
import { useSelectedStop } from '../derived/useSelectedStop';
import { useStopDistance } from '../derived/useStopDistance';
import { EXTERNAL_URLS } from '../../config/constants';

/**
 * useNavigate
 *
 * Walking directions to the selected stop via platform-specific map deep links,
 * plus the user's distance to it.
 */
export const useNavigate = () => {
    const selectedStop = useSelectedStop();
    const stopDistanceInfo = useStopDistance();

    const handleNavigate = useCallback((targetCoordinates?: [number, number]) => {
        const coords = targetCoordinates || selectedStop?.coordinates;
        if (!coords) return;

        const [lon, lat] = coords;
        const isAppleDevice = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

        if (isAppleDevice) {
            window.location.href = EXTERNAL_URLS.WALKING_DIRECTIONS.apple(lat, lon);
        } else {
            // location.href, not window.open, so the deep link doesn't leave a blank tab behind.
            window.location.href = EXTERNAL_URLS.WALKING_DIRECTIONS.google(lat, lon);
        }
    }, [selectedStop]);

    return {
        handleNavigate,
        stopDistanceInfo
    };
};
