import type { StoredEnrichmentPatch } from '../types/enrichment';
import type { Departure, DepartureFeeder, VehicleCollection, VehicleDetail, VehicleFeature, VehicleProperties } from '../types/transit';
import type { RSSItem } from '../types/alerts';
import type { RouteInfo } from '../types/vehicles';
import { DEPARTURES_CONFIG, ENRICHMENT_SILENCE_TTL_MS } from '../config/constants';
import { normalizeRouteType, routeJoinKey } from '../utils/routeTypes';

type PatchIndex = Map<string, StoredEnrichmentPatch>;

const META_KEYS = new Set<keyof StoredEnrichmentPatch>([
    'tripId',
    'vehicleId',
    'dataTimestamp',
    'receivedAt'
]);

export function applyEnrichment<T extends object>(
    base: T,
    tripId: string | undefined | null,
    vehicleId: string | undefined | null,
    byTripId: Map<string, StoredEnrichmentPatch>,
    byVehicleId: Map<string, StoredEnrichmentPatch>,
    baseTimestamp: number,
): T {
    let patch: StoredEnrichmentPatch | undefined;

    if (tripId && byTripId.has(tripId)) {
        patch = byTripId.get(tripId);
    } else if (vehicleId && byVehicleId.has(vehicleId)) {
        patch = byVehicleId.get(vehicleId);
    }

    if (!patch) {
        return base;
    }

    // Gate 2: Silence check (defensive, should be handled by store prune)
    const now = baseTimestamp || Date.now();
    if (now - patch.receivedAt > ENRICHMENT_SILENCE_TTL_MS) {
        return base;
    }

    // Always apply patch fields to base because WS is the primary realtime authority.
    // The enrichmentStore prunes stale patches after 90s.
    const enriched = { ...base };
    let applied = false;

    const patchKeys = Object.keys(patch) as Array<keyof StoredEnrichmentPatch>;
    for (const key of patchKeys) {
        // Skip meta keys
        if (META_KEYS.has(key)) continue;

        const patchValue = patch[key];
        if (patchValue == null) continue;

        // Handle nesting for Vehicle properties
        if (key === 'is_wheelchair_accessible' || key === 'is_air_conditioned') {
            if (!('scheduled' in enriched)) {
                // It's a VehicleDetail (no 'scheduled' field), nest it
                const mut = enriched as Record<string, unknown>;
                if (!mut.vehicle_descriptor) mut.vehicle_descriptor = {};
                (mut.vehicle_descriptor as Record<string, unknown>)[key] = patchValue;
                applied = true;
                continue;
            }
        }

        const mut = enriched as Record<string, unknown>;
        mut[key] = patchValue;
        applied = true;
    }

    const mut = enriched as Record<string, unknown>;

    // Special case for Departures: If we updated the delay, we MUST recalculate the realtime timestamp
    // otherwise the countdown timers will not move.
    if (applied && typeof mut.scheduled === 'string' && typeof mut.delay === 'number') {
        const scheduledMs = new Date(mut.scheduled).getTime();
        mut.timestamp = new Date(scheduledMs + (mut.delay * 1000)).toISOString();
    }

    if (applied) {
        mut.is_enriched = true;
    }

    return applied ? enriched : base;
}

/**
 * The route a `type|name` join key resolves to in the static `routes.json` join, or undefined on a
 * miss - which leaves the caller's existing `route_color` untouched rather than clearing it, so this
 * stays additive over whatever the backend still sends. Keying on type too (not name alone) matters:
 * a line number can be reused across modes (e.g. DÚK's trolleybus 70 and bus 70 are different routes).
 */
const brandFrom = (name: string | undefined, type: string | undefined, byShortName: Map<string, RouteInfo>): RouteInfo | undefined =>
    name ? byShortName.get(routeJoinKey(type, name)) : undefined;

/** A trip's current live properties from the fleet stream, or undefined if it isn't running right now. */
const liveOf = (tripId: string, tripIndex: Map<string, VehicleFeature>): VehicleFeature['properties'] | undefined =>
    tripIndex.get(tripId)?.properties;

/**
 * Overwrites `route_color` on every vehicle from the static routes.json join. A lookup miss leaves
 * the backend-sent value as-is - so this is safe to enable per city independently of whether that
 * city's `routes.json` exists yet.
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

/** Overwrites `route_color` on a departure and its feeders/continuation from the static join. */
export function enrichDepartureRouteMetadata(departures: Departure[], byShortName: Map<string, RouteInfo>): Departure[] {
    if (!departures.length || byShortName.size === 0) return departures;

    let changed = false;
    const result = departures.map((dep): Departure => {
        const route = brandFrom(dep.line, dep.type, byShortName);

        let connections = dep.connections;
        if (connections?.length) {
            let connectionsChanged = false;
            const nextConnections = connections.map((c) => {
                const r = brandFrom(c.line, c.type, byShortName);
                if (!r) return c;
                connectionsChanged = true;
                return { ...c, route_color: r.route_color };
            });
            if (connectionsChanged) connections = nextConnections;
        }

        const continuesRoute = dep.continues_as ? brandFrom(dep.continues_as.line, dep.continues_as.type, byShortName) : undefined;
        const continues_as = continuesRoute ? { ...dep.continues_as!, route_color: continuesRoute.route_color } : dep.continues_as;

        if (!route && connections === dep.connections && continues_as === dep.continues_as) return dep;
        changed = true;
        return { ...dep, ...(route ? { route_color: route.route_color } : {}), connections, continues_as };
    });

    return changed ? result : departures;
}

/**
 * Computes each feeder's live `hold_s`/`will_miss` from its own current delay, looked up by
 * `trip_id` in the live fleet - the backend only sends `base_hold_s` (the hold assuming the feeder
 * is exactly on time), since this needs live data the frontend already has and the backend would
 * otherwise have to look up on every request just to answer it. Recomputes every call since this is
 * live data that changes every poll; `memoizeLast` at the call site avoids redundant work when
 * neither input has changed.
 */
export function enrichFeederHold(departures: Departure[], tripIndex: Map<string, VehicleFeature>): Departure[] {
    if (!departures.length) return departures;
    return departures.map((dep): Departure => {
        if (!dep.connections?.length) return dep;
        const connections = dep.connections.map((f): DepartureFeeder => {
            const delay = liveOf(f.trip_id, tripIndex)?.delay;
            const hold_s = typeof delay === 'number' ? Math.max(0, f.base_hold_s + delay) : null;
            return { ...f, hold_s, will_miss: hold_s !== null && hold_s > f.max_wait_s };
        });
        return { ...dep, connections };
    });
}

/**
 * Resolves each alert's affected-lines list. GTFS-RT-sourced entries arrive with only `route_id` -
 * looked up by id, falling back to KORDIS's numeric-id table when the id isn't a direct match (its
 * alert feed gives a bare numeric id where routes.json's own key is the full GTFS one). RSS-sourced
 * entries already carry `name`/`type` (no route id exists for them) and only pick up `route_color`,
 * via the same by-name join vehicles/departures use.
 */
export function enrichAlertLineMetadata(
    alerts: RSSItem[],
    byId: Map<string, RouteInfo>,
    byName: Map<string, RouteInfo>,
    byKordisNumeric: Map<string, RouteInfo>,
): RSSItem[] {
    if (!alerts.length || (byId.size === 0 && byName.size === 0)) return alerts;

    let changed = false;
    const result = alerts.map((alert): RSSItem => {
        if (!alert.line_metadata?.length) return alert;

        let lineMetadataChanged = false;
        const nextLineMetadata = alert.line_metadata.map((entry) => {
            // GTFS-RT alerts key by route_id; RSS exclusions carry no id, only a plain line name.
            const key = entry.route_id ?? entry.name;
            if (!key) return entry;
            const upper = key.toUpperCase();
            const route = (entry.route_id && byId.get(entry.route_id)) || byName.get(upper) || byKordisNumeric.get(upper);
            lineMetadataChanged = true;
            return route
                ? { ...entry, name: route.name, type: normalizeRouteType(route.type), route_color: route.route_color }
                : { ...entry, name: entry.name ?? key, type: entry.type ?? 'unknown' as const };
        });

        if (!lineMetadataChanged) return alert;
        changed = true;
        return { ...alert, line_metadata: nextLineMetadata };
    });

    return changed ? result : alerts;
}

/** The ID a push patch is keyed by; feeds without vehicle IDs are matched by fleet number. */
const patchVehicleId = (p: VehicleProperties): string | undefined =>
    p.vehicle_id || p.vehicle_descriptor?.vehicle_registration_number?.toString() || undefined;

/**
 * Applies push patches to every vehicle. Returns the input collection itself when no patch applies,
 * so consumers keyed on its identity don't recompute.
 */
export function enrichVehicleCollection(
    collection: VehicleCollection | null | undefined,
    byTripId: PatchIndex,
    byVehicleId: PatchIndex,
    baseTimestamp: number,
): VehicleCollection | null {
    if (!collection) return null;
    if (!collection.features?.length) return collection;

    let changed = false;
    const features = collection.features.map((f): VehicleFeature => {
        const properties = applyEnrichment(f.properties, f.properties.gtfs_trip_id, patchVehicleId(f.properties), byTripId, byVehicleId, baseTimestamp);
        if (properties === f.properties) return f;
        changed = true;
        return { ...f, properties };
    });

    return changed ? { ...collection, features } : collection;
}

/**
 * Applies push patches to departures and drops those whose expected time is past the grace period.
 * `tripIndex` supplies the vehicle ID from the live stream when the departures response lacks it.
 */
export function enrichDepartures(
    departures: Departure[],
    tripIndex: Map<string, VehicleFeature>,
    byTripId: PatchIndex,
    byVehicleId: PatchIndex,
    baseTimestamp: number,
): Departure[] {
    const cutoff = baseTimestamp - DEPARTURES_CONFIG.PAST_GRACE_MS;
    const result: Departure[] = [];

    for (const dep of departures) {
        const vehicleId = dep.vehicleId || (dep.tripId ? liveOf(dep.tripId, tripIndex)?.vehicle_id : undefined) || undefined;
        let enriched = applyEnrichment(dep, dep.tripId, vehicleId, byTripId, byVehicleId, baseTimestamp);
        if (vehicleId && !enriched.vehicleId) {
            enriched = { ...enriched, vehicleId };
        }
        if (new Date(enriched.timestamp).getTime() >= cutoff) {
            result.push(enriched);
        }
    }

    return result;
}

type StopTimeFeature = NonNullable<VehicleDetail['stop_times']>['features'][number];

/**
 * Fills the onward vehicle and its delay into each stop's connections, and the vehicle into its
 * continuation, from the live fleet (already push-patched), and brands both from the static routes
 * join. The backend sends scheduled rows only. Returns `features` itself when nothing changes.
 */
export function enrichConnections(features: StopTimeFeature[], tripIndex: Map<string, VehicleFeature>, byShortName: Map<string, RouteInfo>): StopTimeFeature[] {
    let changed = false;

    const result = features.map((f): StopTimeFeature => {
        const { connections, continues_as } = f.properties;
        if (!connections && !continues_as) return f;

        let featureChanged = false;
        const nextConnections = connections?.map((c) => {
            const live = liveOf(c.trip_id, tripIndex);
            const route = brandFrom(c.line, c.type, byShortName);
            if (!live && !route) return c;
            featureChanged = true;
            return {
                ...c,
                vehicle_id: c.vehicle_id || live?.vehicle_id || undefined,
                delay: typeof live?.delay === 'number' ? live.delay : c.delay,
                ...(route ? { route_color: route.route_color } : {}),
            };
        });

        const onward = continues_as?.trip_id && !continues_as.vehicle_id ? liveOf(continues_as.trip_id, tripIndex) : undefined;
        const continuesRoute = continues_as ? brandFrom(continues_as.line, continues_as.type, byShortName) : undefined;
        const nextContinuation = continues_as && (onward?.vehicle_id || continuesRoute)
            ? { ...continues_as, ...(onward?.vehicle_id ? { vehicle_id: onward.vehicle_id } : {}), ...(continuesRoute ? { route_color: continuesRoute.route_color } : {}) }
            : continues_as;
        if (nextContinuation !== continues_as) featureChanged = true;

        if (!featureChanged) return f;
        changed = true;
        return { ...f, properties: { ...f.properties, connections: nextConnections, continues_as: nextContinuation } };
    });

    return changed ? result : features;
}

/** Overwrites a vehicle detail's own `route_color` from the static routes join. */
export function enrichVehicleDetailRouteMetadata(detail: VehicleDetail, byShortName: Map<string, RouteInfo>): VehicleDetail {
    const route = brandFrom(detail.route_short_name, detail.route_type, byShortName);
    return route ? { ...detail, route_color: route.route_color } : detail;
}
