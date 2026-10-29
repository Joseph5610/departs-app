import { useRouteParams } from '@/hooks/useRouteParams';

/** Whether the route opens the detail panel: a stop, trip, vehicle, point of sale, stats or favourites. */
export const useIsPanelRoute = (): boolean => {
    const { stopId, tripId, vehicleId, posId, isStatsRoute, isFavoritesRoute } = useRouteParams();
    return Boolean(stopId || tripId || vehicleId || posId || isStatsRoute || isFavoritesRoute);
};
