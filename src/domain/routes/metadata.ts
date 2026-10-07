import type { RouteInfo, RouteType } from '@/types';
import { ROUTE_JOIN_SEPARATOR, routeJoinKey } from './routeType';

export interface RouteMetadata {
    /** routeId -> route, as published in routes.json - alerts carry a real GTFS route id, unlike vehicles/departures. */
    byId: Map<string, RouteInfo>;
    /**
     * `routeJoinKey(type, name)` -> route. A short name alone can collide across modes (e.g. a
     * trolleybus and a bus both numbered "70"), so the join key includes the normalized type - the
     * same composite every vehicle/departure/alert entry can already build from its own fields.
     */
    byShortName: RouteLookup;
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

export type RouteTypeColors = Partial<Record<RouteType, string>>;

/** A route join by key: a `Map` or anything that answers `get` and knows how many routes it lists. */
export type RouteLookup = Pick<ReadonlyMap<string, RouteInfo>, 'get' | 'size'>;

/** The `type|name` join, answering a line the routes file does not list with its mode's colour where the city has one. */
const byShortNameWithTypeColors = (routes: Map<string, RouteInfo>, typeColors: RouteTypeColors): RouteLookup => ({
    size: routes.size,
    get: (key) => {
        const route = routes.get(key);
        if (route) return route;
        const split = key.indexOf(ROUTE_JOIN_SEPARATOR);
        const type = key.slice(0, split) as RouteType;
        const route_color = typeColors[type];
        return route_color ? { name: key.slice(split + 1), type, route_color } : undefined;
    },
});

export const NO_TYPE_COLORS: RouteTypeColors = {};

export const EMPTY_ROUTE_METADATA: RouteMetadata = { byId: new Map(), byShortName: new Map(), byName: new Map(), byKordisNumeric: new Map() };

const KORDIS_NUMERIC_ID = /^L([A-Z0-9]+)D/i;

/** A routes file indexed by id, by `type|name`, by plain name and by KORDIS numeric id. */
export const indexRouteMetadata = (data: Record<string, RouteInfo>, typeColors: RouteTypeColors): RouteMetadata => {
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
    return { byId, byShortName: byShortNameWithTypeColors(byShortName, typeColors), byName, byKordisNumeric };
};
