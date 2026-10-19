import type { StopFeature } from '@/types';
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
    feature: StopFeature;
    distance: number;
}

/**
 * The stops closest to `location` within `maxDistanceM`, nearest first, one per stop name so a station's
 * platforms list once, at the nearest. Only platforms served by a line count: stations and entrances
 * are left out.
 */
export const nearestStops = (
    features: readonly StopFeature[],
    location: [number, number] | null,
    limit: number,
    maxDistanceM: number
): NearbyStop[] => {
    if (!location) return [];
    const byName = new Map<string, NearbyStop>();
    for (const feature of features) {
        const { is_drop_off_only, is_station, lines, stop_name } = feature.properties;
        if (is_drop_off_only || is_station || !lines?.length) continue;
        const distance = calculateDistance(location, feature.geometry.coordinates);
        if (distance > maxDistanceM) continue;
        const kept = byName.get(stop_name);
        if (!kept || distance < kept.distance) byName.set(stop_name, { feature, distance });
    }
    return [...byName.values()].sort((a, b) => a.distance - b.distance).slice(0, limit);
};
