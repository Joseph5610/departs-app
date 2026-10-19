import { useStops } from '@/hooks/data/useStops';
import { useGeolocationStore } from '@/state/geolocationStore';
import { nearestStops, type NearbyStop } from '@/domain/stops';
import { memoizeLast } from '@/lib/memoize';
import { NEARBY_STOPS } from '@/config/constants';
import type { Platform } from '@/types';

const NO_PLATFORMS: Platform[] = [];

const nearest = memoizeLast((platforms: readonly Platform[], location: [number, number] | null): NearbyStop[] =>
    nearestStops(platforms, location, NEARBY_STOPS.LIMIT, NEARBY_STOPS.MAX_DISTANCE_M));

/** The stops nearest the user's location, one per name, or none until the location is known. */
export const useNearbyStops = () => {
    const userLocation = useGeolocationStore(s => s.userLocation);
    const { model, isLoading } = useStops();

    return { nearby: nearest(model?.platforms ?? NO_PLATFORMS, userLocation), hasLocation: userLocation !== null, isLoading };
};
