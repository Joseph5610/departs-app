import '../../lib/zod-config';
import { z } from 'zod/mini';
import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '../../state/preferencesStore';
import { apiFetch } from '../../lib/api-client';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '../../config/constants';
import type { RouteInfo } from '../../types/vehicles';
import { routeJoinKey } from '../../utils/routeTypes';
import { memoizeLast } from '../../lib/memoize';

const routesFileSchema = z.record(z.string(), z.object({
    name: z.string(),
    type: z.string(),
    route_color: z.string(),
}));

export interface RouteMetadata {
    /** routeId -> route, as published in routes.json - alerts carry a real GTFS route id, unlike vehicles/departures. */
    byId: Map<string, RouteInfo>;
    /**
     * `routeJoinKey(type, name)` -> route. A short name alone can collide across modes (e.g. a
     * trolleybus and a bus both numbered "70"), so the join key includes the normalized type - the
     * same composite every vehicle/departure/alert entry can already build from its own fields.
     */
    byShortName: Map<string, RouteInfo>;
    /**
     * Uppercased plain name -> route (no type in the key, unlike `byShortName`) - for resolving an
     * alert route id we don't know the type of yet. Mirrors the backend's old `routesByName`.
     */
    byName: Map<string, RouteInfo>;
    /**
     * KORDIS's alert feed gives a bare numeric route id ("120") where routes.json's own key is the
     * full GTFS one ("L120D99") - this is the fallback for that, keyed by the numeric segment. Only
     * a fallback: some routes' *display name* already carries a prefix the id doesn't (night line
     * "L99D99" displays as "N99", so `byName` must be tried before this).
     */
    byKordisNumeric: Map<string, RouteInfo>;
}

const EMPTY: RouteMetadata = { byId: new Map(), byShortName: new Map(), byName: new Map(), byKordisNumeric: new Map() };

const KORDIS_NUMERIC_ID = /^L([A-Z0-9]+)D/i;

/** Module-level so every observer of the same cached file gets the same Map identities, which downstream `memoizeLast` pipelines key on. */
const buildRouteMetadata = memoizeLast((data: Record<string, RouteInfo>): RouteMetadata => {
    const byId = new Map(Object.entries(data));
    const byShortName = new Map<string, RouteInfo>();
    const byName = new Map<string, RouteInfo>();
    const byKordisNumeric = new Map<string, RouteInfo>();
    for (const [id, route] of byId) {
        byShortName.set(routeJoinKey(route.type, route.name), route);
        byName.set(route.name.toUpperCase(), route);
        const match = KORDIS_NUMERIC_ID.exec(id);
        if (match) byKordisNumeric.set(match[1].toUpperCase(), route);
    }
    return { byId, byShortName, byName, byKordisNumeric };
});

/**
 * A city's route branding (name/color), read straight from the static data CDN - the same file the
 * backend's own `routesByName` lookup reads, fetched directly instead of embedded in API responses.
 */
export function useRouteMetadata(): RouteMetadata {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const { data } = useQuery({
        queryKey: ['route-metadata', selectedCity],
        queryFn: async () => routesFileSchema.parse(await apiFetch<unknown>(`${EXTERNAL_URLS.STATIC_DATA}/${selectedCity}/routes.json`)),
        enabled: !!selectedCity,
        select: buildRouteMetadata,
        staleTime: QUERY_TIMING_MS.TRIP_SHAPES_STALE,
        gcTime: QUERY_TIMING_MS.TRIP_SHAPES_GC,
    });

    return data ?? EMPTY;
}
