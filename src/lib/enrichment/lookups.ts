import type { VehicleFeature, VehicleProperties } from '../../types/transit';
import type { RouteInfo, RouteType } from '../../types/vehicles';
import { normalizeRouteType, routeJoinKey } from '../../utils/routeTypes';

/**
 * The route of a `type|name` join key in `routes.json`. A miss leaves the caller's `route_color`
 * untouched. Keyed on type too: a line number can be reused across modes (DÚK trolleybus 70 vs bus 70).
 */
export const brandFrom = (name: string | undefined, type: string | undefined, byShortName: Map<string, RouteInfo>): RouteInfo | undefined =>
    name ? byShortName.get(routeJoinKey(type, name)) : undefined;

/**
 * Line, type and colour by `route_id` (GTFS, which sends no name/type) when present, else by name
 * (Golemio). A `route_id` miss still fills line/type from the backend's value or the bare id;
 * undefined means nothing to add.
 */
const resolveLineType = (
    routeId: string | undefined,
    line: string | undefined,
    type: RouteType | undefined,
    byId: Map<string, RouteInfo>,
    byShortName: Map<string, RouteInfo>,
): { line: string; type: RouteType; route_color?: string } | undefined => {
    if (routeId) {
        const route = byId.get(routeId);
        return route
            ? { line: route.name, type: normalizeRouteType(route.type), route_color: route.route_color }
            : { line: line ?? routeId, type: type ?? 'unknown' };
    }
    const route = brandFrom(line, type, byShortName);
    return route ? { line: line!, type: type!, route_color: route.route_color } : undefined;
};

interface BrandableLine {
    route_id?: string;
    line: string;
    type: RouteType;
    route_color?: string;
}

/** A connection or continuation branded from the routes join; the entry itself when nothing resolves. */
export const withLineBranding = <T extends BrandableLine>(entry: T, byId: Map<string, RouteInfo>, byShortName: Map<string, RouteInfo>): T => {
    const routed = resolveLineType(entry.route_id, entry.line, entry.type, byId, byShortName);
    return routed ? { ...entry, line: routed.line, type: routed.type, route_color: routed.route_color } : entry;
};

/** A trip's current live properties from the fleet stream, or undefined if it isn't running right now. */
export const liveOf = (tripId: string, tripIndex: Map<string, VehicleFeature>): VehicleProperties | undefined =>
    tripIndex.get(tripId)?.properties;
