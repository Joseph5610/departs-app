import '../../lib/zod-config';
import { z } from 'zod/mini';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useCityConfig } from './useCities';
import { apiFetch } from '../../lib/api-client';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '../../config/constants';
import type { RouteInfo, RouteType } from '../../types/vehicles';
import { ROUTE_JOIN_SEPARATOR, routeJoinKey } from '../../utils/routeTypes';
import { createDevicePersister, deviceCacheStaleTime } from '../../lib/deviceCache';

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

type RouteTypeColors = Partial<Record<RouteType, string>>;

/** The `type|name` join, answering a line the routes file does not list with its mode's colour where the city has one. */
class RoutesByShortName extends Map<string, RouteInfo> {
    private readonly typeColors: RouteTypeColors;

    constructor(typeColors: RouteTypeColors) {
        super();
        this.typeColors = typeColors;
    }

    override get(key: string): RouteInfo | undefined {
        const route = super.get(key);
        if (route) return route;
        const split = key.indexOf(ROUTE_JOIN_SEPARATOR);
        const type = key.slice(0, split) as RouteType;
        const route_color = this.typeColors[type];
        return route_color ? { name: key.slice(split + 1), type, route_color } : undefined;
    }
}

export const NO_TYPE_COLORS: RouteTypeColors = {};

const routesPersister = createDevicePersister((data) => routesFileSchema.parse(data));

const EMPTY: RouteMetadata = { byId: new Map(), byShortName: new Map(), byName: new Map(), byKordisNumeric: new Map() };

const KORDIS_NUMERIC_ID = /^L([A-Z0-9]+)D/i;

const indexRoutes = (data: Record<string, RouteInfo>, typeColors: RouteTypeColors): RouteMetadata => {
    const byId = new Map(Object.entries(data));
    const byShortName = new RoutesByShortName(typeColors);
    const byName = new Map<string, RouteInfo>();
    const byKordisNumeric = new Map<string, RouteInfo>();
    for (const [id, route] of byId) {
        byShortName.set(routeJoinKey(route.type, route.name), route);
        byName.set(route.name.toUpperCase(), route);
        const match = KORDIS_NUMERIC_ID.exec(id);
        if (match) byKordisNumeric.set(match[1].toUpperCase(), route);
    }
    return { byId, byShortName, byName, byKordisNumeric };
};

/** Per routes file, so every observer of a city gets the same Map identities, which downstream `memoizeLast` pipelines key on. */
const built = new WeakMap<Record<string, RouteInfo>, { typeColors: RouteTypeColors; metadata: RouteMetadata }>();

export const buildRouteMetadata = (data: Record<string, RouteInfo>, typeColors: RouteTypeColors): RouteMetadata => {
    const existing = built.get(data);
    if (existing?.typeColors === typeColors) return existing.metadata;
    const metadata = indexRoutes(data, typeColors);
    built.set(data, { typeColors, metadata });
    return metadata;
};

export const routesQueryOptions = (city: string) => queryOptions({
    queryKey: ['route-metadata', city],
    queryFn: async () => routesFileSchema.parse(await apiFetch<unknown>(`${EXTERNAL_URLS.STATIC_DATA}/${city}/routes.json`)),
    staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.STATIC_METADATA_STALE),
    gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
    persister: routesPersister,
});

/**
 * A city's route branding (name/color), read straight from the static data CDN - the same file the
 * backend's own `routesByName` lookup reads, fetched directly instead of embedded in API responses.
 * For the selected city unless `city` names another; null reads nothing.
 */
export function useRouteMetadata(city?: string | null): RouteMetadata {
    const ownCity = usePreferencesStore(s => s.selectedCity);
    const selectedCity = city === undefined ? ownCity : city;
    const typeColors = useCityConfig(selectedCity ?? undefined).routeTypeColors ?? NO_TYPE_COLORS;

    const { data } = useQuery({ ...routesQueryOptions(selectedCity ?? ''), enabled: !!selectedCity });

    return data ? buildRouteMetadata(data, typeColors) : EMPTY;
}
