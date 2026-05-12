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
    const { userLocation } = useViewport();

    return useMemo(() => {
        const coords = selectedStop?.coordinates;
        if (!coords || !userLocation) {
            return null;
        }
        const distance = calculateDistance(userLocation, coords);

        const isAtStop = distance < 20;

        return {
            distance: Math.round(distance),
            time: Math.ceil(distance / 60),
            isAtStop,
            isReasonableWalkingDistance: distance < 750
        };
    }, [selectedStop?.coordinates, userLocation]);
};
