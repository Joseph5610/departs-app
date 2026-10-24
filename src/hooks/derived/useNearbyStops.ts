import { useStops } from '@/hooks/data/useStops';
import { useGeolocationStore } from '@/state/geolocationStore';
import { nearestStops, type NearbyStop } from '@/domain/stops';
import { memoizeLast } from '@/lib/memoize';
import { NEARBY_STOPS } from '@/config/constants';
import { calculateDistance } from '@/lib/geo';
import type { Platform } from '@/types';

const NO_PLATFORMS: Platform[] = [];

type NearestArgs = [platforms: readonly Platform[], location: [number, number] | null];

const sameSpot = ([platforms, location]: NearestArgs, [nextPlatforms, nextLocation]: NearestArgs) =>
    platforms === nextPlatforms && (location === nextLocation || (!!location && !!nextLocation && calculateDistance(location, nextLocation) < NEARBY_STOPS.REFRESH_DISTANCE_M));

const nearest = memoizeLast((...[platforms, location]: NearestArgs): NearbyStop[] =>
    nearestStops(platforms, location, NEARBY_STOPS.LIMIT, NEARBY_STOPS.MAX_DISTANCE_M), sameSpot);

/** The stops nearest the user's location, one per station, or none until the location is known. */
export const useNearbyStops = () => {
    const userLocation = useGeolocationStore(s => s.userLocation);
    const { model, isLoading } = useStops();

    return { nearby: nearest(model?.platforms ?? NO_PLATFORMS, userLocation), hasLocation: userLocation !== null, isLoading };
};
