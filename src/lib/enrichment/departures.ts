import type { Departure, DepartureFeeder, VehicleFeature } from '../../types/transit';
import type { FleetLookup, RouteInfo } from '../../types/vehicles';
import { DEPARTURES_CONFIG } from '../../config/constants';
import { brandFrom, liveOf, withLineBranding } from './lookups';
import { applyEnrichment, type PatchIndex } from './patches';

/** Overwrites `route_color` on a departure and its feeders/continuation from the routes join. */
function withRouteMetadata(departures: Departure[], byShortName: Map<string, RouteInfo>, byId: Map<string, RouteInfo>): Departure[] {
    if (!departures.length || (byShortName.size === 0 && byId.size === 0)) return departures;

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

        const continues_as = dep.continues_as && withLineBranding(dep.continues_as, byId, byShortName);

        if (!route && connections === dep.connections && continues_as === dep.continues_as) return dep;
        changed = true;
        return { ...dep, ...(route ? { route_color: route.route_color } : {}), connections, continues_as };
    });

    return changed ? result : departures;
}

/** AC and low-floor of each departure's live vehicle from the fleet register; the live stream may still override them. */
function withFleetMetadata(departures: Departure[], fleet: FleetLookup | undefined): Departure[] {
    if (!fleet) return departures;
    let changed = false;
    const result = departures.map((dep) => {
        const metadata = dep.vehicleId ? fleet(dep.vehicleId) : undefined;
        if (metadata?.is_air_conditioned === undefined && metadata?.is_wheelchair_accessible === undefined) return dep;
        changed = true;
        return {
            ...dep,
            is_air_conditioned: metadata.is_air_conditioned ?? dep.is_air_conditioned,
            is_wheelchair_accessible: metadata.is_wheelchair_accessible ?? dep.is_wheelchair_accessible,
        };
    });
    return changed ? result : departures;
}

/**
 * Applies push patches to departures and drops those whose expected time is past the grace period.
 * `tripIndex` supplies the vehicle ID from the live stream when the departures response lacks it.
 */
function withLivePatches(
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

/**
 * Each feeder's live `hold_s`/`will_miss` from its own current delay; the backend only sends
 * `base_hold_s`, the hold for an on-time feeder.
 */
function withFeederHold(departures: Departure[], tripIndex: Map<string, VehicleFeature>): Departure[] {
    let changed = false;
    const result = departures.map((dep): Departure => {
        if (!dep.connections?.length) return dep;
        changed = true;
        const connections = dep.connections.map((f): DepartureFeeder => {
            const delay = liveOf(f.trip_id, tripIndex)?.delay;
            const hold_s = typeof delay === 'number' ? Math.max(0, f.base_hold_s + delay) : null;
            return { ...f, hold_s, will_miss: hold_s !== null && hold_s > f.max_wait_s };
        });
        return { ...dep, connections };
    });
    return changed ? result : departures;
}

/** The full live pipeline for fetched departures: static branding, fleet register, push patches and past-drop, then feeder holds. */
export function enrichLiveDepartures(
    departures: Departure[],
    tripIndex: Map<string, VehicleFeature>,
    byTripId: PatchIndex,
    byVehicleId: PatchIndex,
    byShortName: Map<string, RouteInfo>,
    byId: Map<string, RouteInfo>,
    baseTimestamp: number,
    fleet?: FleetLookup,
): Departure[] {
    const branded = withFleetMetadata(withRouteMetadata(departures, byShortName, byId), fleet);
    const patched = withLivePatches(branded, tripIndex, byTripId, byVehicleId, baseTimestamp);
    return withFeederHold(patched, tripIndex);
}
