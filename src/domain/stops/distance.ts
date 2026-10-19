import type { Platform } from '@/types';
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

export interface NearbyStop {
    stop: Platform;
    distance: number;
}

/**
 * The stops closest to `location` within `maxDistanceM`, nearest first, one per station: its nearest platform.
 * Only platforms served by a line count.
 */
export const nearestStops = (
    platforms: readonly Platform[],
    location: [number, number] | null,
    limit: number,
    maxDistanceM: number
): NearbyStop[] => {
    if (!location) return [];
    const byStation = new Map<string, NearbyStop>();
    for (const stop of platforms) {
        if (stop.alightOnly || !stop.lines.length) continue;
        const distance = calculateDistance(location, stop.pos);
        if (distance > maxDistanceM) continue;
        const kept = byStation.get(stop.station);
        if (!kept || distance < kept.distance) byStation.set(stop.station, { stop, distance });
    }
    return [...byStation.values()].sort((a, b) => a.distance - b.distance).slice(0, limit);
};
