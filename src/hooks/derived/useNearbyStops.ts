import { useStops } from '@/hooks/data/useStops';
import { useGeolocationStore } from '@/state/geolocationStore';
import { nearestStops, type NearbyStop } from '@/domain/stops';
import { memoizeLast } from '@/lib/memoize';
import { NEARBY_STOPS } from '@/config/constants';
import type { StopFeature } from '@/types';

const NO_FEATURES: StopFeature[] = [];

const nearest = memoizeLast((features: readonly StopFeature[], location: [number, number] | null): NearbyStop[] =>
    nearestStops(features, location, NEARBY_STOPS.LIMIT, NEARBY_STOPS.MAX_DISTANCE_M));

/** The stops nearest the user's location, one per name, or none until the location is known. */
export const useNearbyStops = () => {
    const userLocation = useGeolocationStore(s => s.userLocation);
    const { allFeatures, isLoading } = useStops();

    return { nearby: nearest(allFeatures?.features ?? NO_FEATURES, userLocation), hasLocation: userLocation !== null, isLoading };
};
