import { useRoute } from 'wouter';
import { ROUTE_PATTERNS, decodeRouteParam } from '../lib/routes';

/**
 * Parses the transit route params from the URL. Side-effect free, so any component may call it;
 * syncing the URL city into the store happens once, in `useRouteCitySync`.
 */
export const useRouteParams = () => {
    const [isStop, stopParams] = useRoute(ROUTE_PATTERNS.stop);
    const [isPos, posRouteParams] = useRoute(ROUTE_PATTERNS.pos);
    const [isTrip, tripParams] = useRoute(ROUTE_PATTERNS.trip);
    const [isTripVehicle, tripVehicleParams] = useRoute(ROUTE_PATTERNS.tripVehicle);
    const [isStatsRoute, statsParams] = useRoute(ROUTE_PATTERNS.stats);
    const [isFavoritesRoute, favoritesParams] = useRoute(ROUTE_PATTERNS.favorites);
    const [isCityBase, cityBaseParams] = useRoute(ROUTE_PATTERNS.city);

    let city = null;
    let stopId = null;
    let posId = null;
    let tripId = null;
    let vehicleId = null;

    if (isTripVehicle) {
        city = decodeRouteParam(tripVehicleParams.city);
        tripId = decodeRouteParam(tripVehicleParams.tripId);
        vehicleId = decodeRouteParam(tripVehicleParams.vehicleId);
    } else if (isTrip) {
        city = decodeRouteParam(tripParams.city);
        tripId = decodeRouteParam(tripParams.tripId);
    } else if (isStop) {
        city = decodeRouteParam(stopParams.city);
        stopId = decodeRouteParam(stopParams.stopId);
    } else if (isPos) {
        city = decodeRouteParam(posRouteParams.city);
        posId = decodeRouteParam(posRouteParams.posId);
    } else if (isStatsRoute) {
        city = decodeRouteParam(statsParams.city);
    } else if (isFavoritesRoute) {
        city = decodeRouteParam(favoritesParams.city);
    } else if (isCityBase) {
        city = decodeRouteParam(cityBaseParams.city);
    }

    return { city, stopId, posId, tripId, vehicleId, isStatsRoute, isFavoritesRoute, isCityBase };
};
