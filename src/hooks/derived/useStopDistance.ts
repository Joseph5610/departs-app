import { useMemo } from 'react';
import { useViewport } from '../../state/contexts';
import { useSelectedStop } from './useSelectedStop';
import { calculateDistance } from '../../utils/transitUtils';

/**
 * useStopDistance
 * 
 * Calculates the current distance and walking time from the user's location 
 * to the selected stop. Also determines if the user is currently at the stop 
 * or if they should see an indicator for "catching" the departure.
 */
export const useStopDistance = () => {
    const selectedStop = useSelectedStop();
    const { userLocation, userSpeed } = useViewport();

    return useMemo(() => {
        const coords = selectedStop?.coordinates;
        if (!coords || !userLocation) {
            return null;
        }
        const distance = calculateDistance(userLocation, coords);

        const isAtStop = distance < 20;
        const isMovingFast = userSpeed !== null && userSpeed > 4;

        return {
            distance: Math.round(distance),
            time: Math.ceil(distance / 60),
            isAtStop,
            showCatchIndicator: distance < 750 && !isMovingFast,
            isReasonableWalkingDistance: distance < 750
        };
    }, [selectedStop?.coordinates, userLocation, userSpeed]);
};
