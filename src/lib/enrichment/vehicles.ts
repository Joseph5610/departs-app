import type { VehicleCollection, VehicleDetail, VehicleFeature } from '../../types/transit';
import type { RouteInfo } from '../../types/vehicles';
import { brandFrom, liveOf, withLineBranding } from './lookups';

/**
 * Overwrites `route_color` on every vehicle from the routes join. A miss keeps the backend value, so
 * this is safe for a city whose `routes.json` doesn't exist yet.
 */
export function enrichVehicleRouteMetadata(
    collection: VehicleCollection | null | undefined,
    byShortName: Map<string, RouteInfo>,
): VehicleCollection | null {
    if (!collection) return null;
    if (!collection.features?.length || byShortName.size === 0) return collection;

    let changed = false;
    const features = collection.features.map((f): VehicleFeature => {
        const route = brandFrom(f.properties.route_short_name, f.properties.route_type, byShortName);
        if (!route) return f;
        changed = true;
        return { ...f, properties: { ...f.properties, route_color: route.route_color } };
    });

    return changed ? { ...collection, features } : collection;
}

/** Overwrites a vehicle detail's own `route_color` from the routes join. */
export function enrichVehicleDetailRouteMetadata(detail: VehicleDetail, byShortName: Map<string, RouteInfo>): VehicleDetail {
    const route = brandFrom(detail.route_short_name, detail.route_type, byShortName);
    return route ? { ...detail, route_color: route.route_color } : detail;
}

type StopTimeFeature = NonNullable<VehicleDetail['stop_times']>['features'][number];

/**
 * Brands each stop's connections and continuation from the routes join and fills in their live
 * vehicle and delay from the (push-patched) fleet; the backend sends scheduled rows only.
 * Returns `features` itself when nothing changes.
 */
export function enrichConnections(
    features: StopTimeFeature[],
    tripIndex: Map<string, VehicleFeature>,
    byShortName: Map<string, RouteInfo>,
    byId: Map<string, RouteInfo>,
): StopTimeFeature[] {
    let changed = false;

    const result = features.map((f): StopTimeFeature => {
        const { connections, continues_as } = f.properties;
        if (!connections && !continues_as) return f;

        let featureChanged = false;
        const nextConnections = connections?.map((c) => {
            const branded = withLineBranding(c, byId, byShortName);
            const live = liveOf(c.trip_id, tripIndex);
            if (branded === c && !live) return c;
            featureChanged = true;
            return live
                ? { ...branded, vehicle_id: c.vehicle_id || live.vehicle_id || undefined, delay: typeof live.delay === 'number' ? live.delay : c.delay }
                : branded;
        });

        let nextContinuation = continues_as && withLineBranding(continues_as, byId, byShortName);
        const onward = nextContinuation?.trip_id && !nextContinuation.vehicle_id ? liveOf(nextContinuation.trip_id, tripIndex) : undefined;
        if (nextContinuation && onward?.vehicle_id) nextContinuation = { ...nextContinuation, vehicle_id: onward.vehicle_id };
        if (nextContinuation !== continues_as) featureChanged = true;

        if (!featureChanged) return f;
        changed = true;
        return { ...f, properties: { ...f.properties, connections: nextConnections, continues_as: nextContinuation } };
    });

    return changed ? result : features;
}
