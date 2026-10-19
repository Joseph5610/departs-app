import { ROUTE_TYPE_ORDER } from '@/config/transit';
import type { RouteType } from '@/types';

export const ROUTE_JOIN_SEPARATOR = '|';

/**
 * The key the frontend's route-metadata join uses: a line number alone can collide across modes
 * (e.g. DÚK's trolleybus 70 and bus 70 are different routes with different colors), so the join keys
 * on `type|name` rather than name alone.
 */
export const routeJoinKey = (type: RouteType | undefined, name: string): string =>
    `${type ?? 'unknown'}${ROUTE_JOIN_SEPARATOR}${name.toUpperCase()}`;

const ROUTE_TYPE_RANK = new Map<RouteType, number>(ROUTE_TYPE_ORDER.map((type, i) => [type, i]));

/** Position of a mode in ROUTE_TYPE_ORDER; anything else (`unknown`, an alert's `other`) sorts last. */
export const routeTypeRank = (type: string | undefined): number =>
    ROUTE_TYPE_RANK.get(type as RouteType) ?? ROUTE_TYPE_ORDER.length;

/** The leading mode among `types` in ROUTE_TYPE_ORDER (metro before train before tram...), or `unknown` for none. */
export const primaryRouteType = (types: readonly RouteType[]): RouteType => {
    let best: RouteType = 'unknown';
    for (const type of types) {
        if (routeTypeRank(type) < routeTypeRank(best)) best = type;
    }
    return best;
};
