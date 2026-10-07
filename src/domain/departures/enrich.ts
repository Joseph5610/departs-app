import type { Departure, DepartureFeeder, VehicleFeature, FleetLookup, RouteInfo } from '@/types';
import { DEPARTURES_CONFIG } from '@/config/constants';
import { brandFrom, withLineBranding } from '@/domain/routes/branding';
import { applyEnrichment, liveOf, type PatchIndex } from '@/domain/realtime/patches';
import { mapStable } from '@/lib/memoize';
import type { RouteLookup } from '@/domain/routes/metadata';

/** Overwrites `route_color` on a departure and its feeders/continuation from the routes join. */
function withRouteMetadata(departures: Departure[], byShortName: RouteLookup, byId: Map<string, RouteInfo>): Departure[] {
    if (!departures.length || (byShortName.size === 0 && byId.size === 0)) return departures;

    return mapStable(departures, (dep) => {
        const route = brandFrom(dep.line, dep.type, byShortName);
        const connections = dep.connections && mapStable(dep.connections, (c) => {
            const r = brandFrom(c.line, c.type, byShortName);
            return r ? { ...c, route_color: r.route_color } : c;
        });
        const continues_as = dep.continues_as && withLineBranding(dep.continues_as, byId, byShortName);

        if (!route && connections === dep.connections && continues_as === dep.continues_as) return dep;
        return { ...dep, ...(route ? { route_color: route.route_color } : {}), connections, continues_as };
    });
}

/** AC and low-floor of each departure's live vehicle from the fleet register; the live stream may still override them. */
function withFleetMetadata(departures: Departure[], fleet: FleetLookup | undefined): Departure[] {
    if (!fleet) return departures;
    return mapStable(departures, (dep) => {
        const metadata = dep.vehicleId ? fleet(dep.vehicleId) : undefined;
        if (metadata?.is_air_conditioned === undefined && metadata?.is_wheelchair_accessible === undefined) return dep;
        return {
            ...dep,
            is_air_conditioned: metadata.is_air_conditioned ?? dep.is_air_conditioned,
            is_wheelchair_accessible: metadata.is_wheelchair_accessible ?? dep.is_wheelchair_accessible,
        };
    });
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
    return departures
        .map((dep) => {
            const vehicleId = dep.vehicleId || (dep.tripId ? liveOf(dep.tripId, tripIndex)?.vehicle_id : undefined) || undefined;
            const enriched = applyEnrichment(dep, dep.tripId, vehicleId, byTripId, byVehicleId, baseTimestamp);
            return vehicleId && !enriched.vehicleId ? { ...enriched, vehicleId } : enriched;
        })
        .filter((dep) => Date.parse(dep.timestamp) >= cutoff);
}

/**
 * Each feeder's live `hold_s`/`will_miss` from its own current delay; the backend only sends
 * `base_hold_s`, the hold for an on-time feeder.
 */
function withFeederHold(departures: Departure[], tripIndex: Map<string, VehicleFeature>): Departure[] {
    return mapStable(departures, (dep): Departure => {
        if (!dep.connections?.length) return dep;
        const connections = dep.connections.map((f): DepartureFeeder => {
            const delay = liveOf(f.trip_id, tripIndex)?.delay;
            const hold_s = typeof delay === 'number' ? Math.max(0, f.base_hold_s + delay) : null;
            return { ...f, hold_s, will_miss: hold_s !== null && hold_s > f.max_wait_s };
        });
        return { ...dep, connections };
    });
}

/** The full live pipeline for fetched departures: static branding, fleet register, push patches and past-drop, then feeder holds. */
export function enrichLiveDepartures(
    departures: Departure[],
    tripIndex: Map<string, VehicleFeature>,
    byTripId: PatchIndex,
    byVehicleId: PatchIndex,
    byShortName: RouteLookup,
    byId: Map<string, RouteInfo>,
    baseTimestamp: number,
    fleet?: FleetLookup,
): Departure[] {
    const branded = withFleetMetadata(withRouteMetadata(departures, byShortName, byId), fleet);
    const patched = withLivePatches(branded, tripIndex, byTripId, byVehicleId, baseTimestamp);
    return withFeederHold(patched, tripIndex);
}
