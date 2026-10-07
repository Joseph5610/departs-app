import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { StopCollection, VehicleCollection, RouteInfo } from '@/types';
import { useViewportStore } from '@/state/viewportStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { enrichVehicleRouteMetadata, filterVehiclesToView } from '@/domain/vehicles';
import { memoizeLast } from '@/lib/memoize';
import { concatCollections, tagStops, tagVehicles } from '@/domain/cities';
import { NO_TYPE_COLORS } from '@/domain/routes';
import { buildRouteMetadata, routesQueryOptions } from './useRouteMetadata';
import { networkVehiclesQueryOptions } from './useVehicles';
import { stopsQueryOptions } from './useStops';
import { splitStopCollection } from '@/domain/stops';

const NO_ROUTES = new Map<string, RouteInfo>();

/** One network's pipeline, memoized per network so two networks in view do not evict each other's results. */
const createPipeline = () => ({
    brand: memoizeLast(enrichVehicleRouteMetadata),
    view: memoizeLast(filterVehiclesToView),
    tagVehicles: memoizeLast(tagVehicles),
    split: memoizeLast(splitStopCollection),
    tagStops: memoizeLast(tagStops),
    tagCentroids: memoizeLast(tagStops),
});
const pipelines = new Map<string, ReturnType<typeof createPipeline>>();
const pipelineOf = (city: string) => {
    let pipeline = pipelines.get(city);
    if (!pipeline) pipelines.set(city, pipeline = createPipeline());
    return pipeline;
};

const concatVehicles = memoizeLast(concatCollections<VehicleCollection>);
const concatStops = memoizeLast(concatCollections<StopCollection>);
const concatCentroids = memoizeLast(concatCollections<StopCollection>);

/**
 * The vehicles in view and the stops of the other networks that run where the map is, each feature
 * carrying its `city_slug` so opening one moves the selection to its network.
 */
export const useOverlayNetworks = (cities: readonly string[]) => {
    const bounds = useViewportStore(s => s.debouncedBounds);
    const routeFilter = useViewportStore(s => s.routeFilter);
    const routeTypeFilter = usePreferencesStore(s => s.routeTypeFilter);
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;

    const vehicles = useQueries({ queries: cities.map(city => networkVehiclesQueryOptions(city, refreshMs)) });
    const stops = useQueries({ queries: cities.map(city => stopsQueryOptions(city)) });
    const routes = useQueries({ queries: cities.map(city => routesQueryOptions(city)) });

    const perNetwork = cities.map((city, i) => {
        const p = pipelineOf(city);
        const routeData = routes[i]?.data;
        const byShortName = routeData ? buildRouteMetadata(routeData, FRONTEND_CITIES_CONFIG[city]?.routeTypeColors ?? NO_TYPE_COLORS).byShortName : NO_ROUTES;
        const branded = p.brand(vehicles[i]?.data, byShortName);
        const split = p.split(stops[i]?.data);
        return {
            vehicles: p.tagVehicles(p.view(branded, bounds, routeFilter, routeTypeFilter), city),
            stops: p.tagStops(split.stops, city, FRONTEND_CITIES_CONFIG[city]?.stopColor),
            centroids: p.tagCentroids(split.centroids, city, FRONTEND_CITIES_CONFIG[city]?.stopColor),
        };
    });

    const allVehicles = concatVehicles(...perNetwork.map(n => n.vehicles));
    const allStops = concatStops(...perNetwork.map(n => n.stops));
    const allCentroids = concatCentroids(...perNetwork.map(n => n.centroids));

    return useMemo(() => ({ vehicles: allVehicles, stops: allStops, centroids: allCentroids }), [allVehicles, allStops, allCentroids]);
};
