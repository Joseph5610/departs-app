import { useMemo } from 'react';
import { useGeolocationStore } from '../../state/geolocationStore';
import { useSelectedStop } from './useSelectedStop';
import { calculateDistance } from '../../utils/transitUtils';
import {
    WALKING_SPEED,
    AT_STOP_THRESHOLD_METERS,
    MAX_REASONABLE_WALKING_DISTANCE
} from '../../config/constants';

/**
 * useStopDistance
 * 
 * Calculates the current distance and walking time from the user's location 
 * to the selected stop. Also determines if the user is currently at the stop 
 * or if they should see an indicator for "catching" the departure.
 */
export const useStopDistance = () => {
    const selectedStop = useSelectedStop();
    const userLocation = useGeolocationStore(s => s.userLocation);

    return useMemo(() => {
        const coords = selectedStop?.coordinates;
        if (!coords || !userLocation) {
            return null;
        }
        const distance = calculateDistance(userLocation, coords);

        const isAtStop = distance < AT_STOP_THRESHOLD_METERS;
        const walkingTimeSec = distance / WALKING_SPEED;

        return {
            distance: Math.round(distance),
            time: Math.ceil(walkingTimeSec / 60),
            isAtStop,
            isReasonableWalkingDistance: distance < MAX_REASONABLE_WALKING_DISTANCE
        };
    }, [selectedStop?.coordinates, userLocation]);
};
