import type { StopTimeFeature, VehicleCollection, VehicleDetail, VehicleFeature, RouteInfo } from '@/types';
import { brandFrom, withLineBranding } from '@/domain/routes/branding';
import { liveOf } from '@/domain/realtime/patches';
import { mapStable } from '@/lib/memoize';
import type { RouteLookup } from '@/domain/routes/metadata';

/**
 * Overwrites `route_color` on every vehicle from the routes join. A miss keeps the backend value, so
 * this is safe for a city whose `routes.json` doesn't exist yet.
 */
export function enrichVehicleRouteMetadata(
    collection: VehicleCollection | null | undefined,
    byShortName: RouteLookup,
): VehicleCollection | null {
    if (!collection) return null;
    if (!collection.features?.length || byShortName.size === 0) return collection;

    const features = mapStable(collection.features, (f) => {
        const route = brandFrom(f.properties.route_short_name, f.properties.route_type, byShortName);
        return route ? { ...f, properties: { ...f.properties, route_color: route.route_color } } : f;
    });
    return features === collection.features ? collection : { ...collection, features };
}

/** Overwrites a vehicle detail's own `route_color` from the routes join. */
export function enrichVehicleDetailRouteMetadata(detail: VehicleDetail, byShortName: RouteLookup): VehicleDetail {
    const route = brandFrom(detail.route_short_name, detail.route_type, byShortName);
    return route ? { ...detail, route_color: route.route_color } : detail;
}


/**
 * Brands each stop's connections and continuation from the routes join and fills in their live
 * vehicle and delay from the (push-patched) fleet; the backend sends scheduled rows only.
 * Returns `features` itself when nothing changes.
 */
export function enrichConnections(
    features: StopTimeFeature[],
    tripIndex: Map<string, VehicleFeature>,
    byShortName: RouteLookup,
    byId: Map<string, RouteInfo>,
): StopTimeFeature[] {
    return mapStable(features, (f) => {
        const { connections, continues_as } = f.properties;
        if (!connections && !continues_as) return f;

        const nextConnections = connections && mapStable(connections, (c) => {
            const branded = withLineBranding(c, byId, byShortName);
            const live = liveOf(c.trip_id, tripIndex);
            if (!live) return branded;
            return { ...branded, vehicle_id: c.vehicle_id || live.vehicle_id || undefined, delay: typeof live.delay === 'number' ? live.delay : c.delay };
        });

        let nextContinuation = continues_as && withLineBranding(continues_as, byId, byShortName);
        const onward = nextContinuation?.trip_id && !nextContinuation.vehicle_id ? liveOf(nextContinuation.trip_id, tripIndex) : undefined;
        if (nextContinuation && onward?.vehicle_id) nextContinuation = { ...nextContinuation, vehicle_id: onward.vehicle_id };

        if (nextConnections === connections && nextContinuation === continues_as) return f;
        return { ...f, properties: { ...f.properties, connections: nextConnections, continues_as: nextContinuation } };
    });
}
