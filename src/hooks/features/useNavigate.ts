import { useCallback } from 'react';
import { useSelectedStop } from '@/hooks/derived/useSelectedStop';
import { useStopDistance } from '@/hooks/derived/useStopDistance';
import { EXTERNAL_URLS } from '@/config/constants';

/**
 * Walking directions to `target` (the selected stop by default) via platform-specific map deep links,
 * plus the user's distance to it.
 */
export const useNavigate = (target?: [number, number]) => {
    const selectedStop = useSelectedStop();
    const coords = target ?? selectedStop?.coordinates;
    const stopDistanceInfo = useStopDistance(coords);

    const handleNavigate = useCallback(() => {
        if (!coords) return;

        const [lon, lat] = coords;
        const isAppleDevice = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

        if (isAppleDevice) {
            window.location.href = EXTERNAL_URLS.WALKING_DIRECTIONS.apple(lat, lon);
        } else {
            // location.href, not window.open, so the deep link doesn't leave a blank tab behind.
            window.location.href = EXTERNAL_URLS.WALKING_DIRECTIONS.google(lat, lon);
        }
    }, [coords]);

    return {
        handleNavigate,
        stopDistanceInfo
    };
};
