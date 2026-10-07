import { calculateDistance } from '@/lib/geo';
import { WALKING } from '@/config/constants';

export interface StopDistanceInfo {
    distance: number;
    time: number;
    isAtStop: boolean;
    isReasonableWalkingDistance: boolean;
}

export const getStopDistanceInfo = (
    userLocation: [number, number] | null,
    coords: [number, number] | null | undefined
): StopDistanceInfo | null => {
    if (!coords || !userLocation) {
        return null;
    }
    const distance = calculateDistance(userLocation, coords);
    const isAtStop = distance < WALKING.AT_STOP_M;
    const walkingTimeSec = distance / WALKING.SPEED_MPS;

    return {
        distance: Math.round(distance),
        time: Math.ceil(walkingTimeSec / 60),
        isAtStop,
        isReasonableWalkingDistance: distance < WALKING.MAX_REASONABLE_M
    };
};
