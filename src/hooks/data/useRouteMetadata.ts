import '../../lib/zod-config';
import { z } from 'zod/mini';
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '../../state/preferencesStore';
import { apiFetch } from '../../lib/api-client';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '../../config/constants';
import type { RouteInfo } from '../../types/vehicles';
import { routeJoinKey } from '../../utils/routeTypes';

const routesFileSchema = z.record(z.string(), z.object({
    name: z.string(),
    type: z.string(),
    route_color: z.string(),
}));

export interface RouteMetadata {
    /**
     * `routeJoinKey(type, name)` -> route. A short name alone can collide across modes (e.g. a
     * trolleybus and a bus both numbered "70"), so the join key includes the normalized type - the
     * same composite every vehicle/departure/alert entry can already build from its own fields.
     */
    byShortName: Map<string, RouteInfo>;
}

const EMPTY: RouteMetadata = { byShortName: new Map() };

/**
 * A city's route branding (name/color), read straight from the static data CDN - the same file the
 * backend's own `routesByName` lookup reads, fetched directly instead of embedded in API responses.
 */
export function useRouteMetadata(): RouteMetadata {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const select = useCallback((data: Record<string, RouteInfo>): RouteMetadata => {
        const byShortName = new Map<string, RouteInfo>();
        for (const route of Object.values(data)) byShortName.set(routeJoinKey(route.type, route.name), route);
        return { byShortName };
    }, []);

    const { data } = useQuery({
        queryKey: ['route-metadata', selectedCity],
        queryFn: async () => routesFileSchema.parse(await apiFetch<unknown>(`${EXTERNAL_URLS.STATIC_DATA}/${selectedCity}/routes.json`)),
        enabled: !!selectedCity,
        select,
        staleTime: QUERY_TIMING_MS.TRIP_SHAPES_STALE,
        gcTime: QUERY_TIMING_MS.TRIP_SHAPES_GC,
    });

    return data ?? EMPTY;
}
