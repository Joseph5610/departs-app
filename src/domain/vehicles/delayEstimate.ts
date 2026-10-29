import type { StopTimeSlice, StoredEnrichmentPatch, VehicleCollection, VehicleFeature } from '@/types';
import { DELAY_ESTIMATE_CONFIG, ENRICHMENT_CONFIG } from '@/config/constants';
import { secondsOfDayIn } from '@/domain/time';
import type { PatchIndex } from '@/domain/realtime';
import { calculateDistance as distance, hasPosition } from '@/lib/geo';
import { wrapDaySeconds } from '@shared/time';

/** A timetable slice with its stops indexed by id, and its trips decoded on first use. */
export interface StopTimeIndex {
    slice: StopTimeSlice;
    stopIndex: Map<string, number>;
    decoded: Map<string, TripTimes>;
}

/** A trip's stops (slice indexes) with arrival and departure in service-day seconds. */
interface TripTimes {
    stops: number[];
    arr: number[];
    dep: number[];
}

export function indexStopTimeSlice(slice: StopTimeSlice | null | undefined): StopTimeIndex | null {
    if (!slice) return null;
    const stopIndex = new Map<string, number>();
    slice.stops.forEach((id, i) => stopIndex.set(id, i));
    return { slice, stopIndex, decoded: new Map() };
}

function decodeTrip(row: number[]): TripTimes {
    const stops: number[] = [], arr: number[] = [], dep: number[] = [];
    let prevDep = 0;
    for (let i = 0; i + 2 < row.length; i += 3) {
        const arrival = i === 0 ? row[i + 1] : prevDep + row[i + 1];
        prevDep = arrival + row[i + 2];
        stops.push(row[i]);
        arr.push(arrival * 60);
        dep.push(prevDep * 60);
    }
    return { stops, arr, dep };
}

/** A trip's calls from the slice, decoded once per slice; undefined when the slice does not list it. */
function tripTimesOf(index: StopTimeIndex, tripId: string): TripTimes | undefined {
    let trip = index.decoded.get(tripId);
    if (!trip) {
        if (!Object.hasOwn(index.slice.trips, tripId)) return undefined;
        trip = decodeTrip(index.slice.trips[tripId]);
        index.decoded.set(tripId, trip);
    }
    return trip.stops.length ? trip : undefined;
}

/** Index of the reported stop on the trip; for a stop served twice, the call nearest in time to `t`. */
function callIndex(trip: TripTimes, stop: number, t: number): number {
    let best = -1;
    for (let i = 0; i < trip.stops.length; i++) {
        if (trip.stops[i] !== stop) continue;
        if (best < 0 || Math.abs(wrapDaySeconds(t - trip.arr[i])) < Math.abs(wrapDaySeconds(t - trip.arr[best]))) best = i;
    }
    return best;
}

/** Share of the way from `a` to `b` a vehicle at `p` has covered, from its straight-line distances to both. */
function straightLineProgress(a: [number, number], b: [number, number], p: [number, number]): number {
    const fromA = distance(a, p);
    const toB = distance(p, b);
    return fromA + toB > 0 ? fromA / (fromA + toB) : 0.5;
}

/**
 * The call a vehicle at `p` is heading to: the end of the leg it deviates least from (a stop it passes without
 * calling); -1 when it is near none of them, so it is not on this trip.
 */
function legByPosition(trip: TripTimes, coords: [number, number][], p: [number, number]): number {
    let best = -1, bestDetour = Infinity;
    for (let i = 1; i < trip.stops.length; i++) {
        const a = coords[trip.stops[i - 1]], b = coords[trip.stops[i]];
        const leg = distance(a, b);
        const detour = distance(a, p) + distance(p, b) - leg;
        const allowed = Math.max(leg * DELAY_ESTIMATE_CONFIG.LEG_DETOUR_SHARE, DELAY_ESTIMATE_CONFIG.LEG_DETOUR_MIN_M);
        if (detour <= allowed && detour < bestDetour) { bestDetour = detour; best = i; }
    }
    return best;
}

/**
 * A vehicle's delay in seconds from where its trip's timetable puts it at the time of its position: before the
 * trip against its first departure, at a stop against that stop's arrival and departure, between stops against
 * the schedule interpolated by its progress. Null when the trip has finished or the vehicle cannot be placed on it.
 */
export function estimateDelay(vehicle: VehicleFeature, index: StopTimeIndex, timeZone: string): number | null {
    const p = vehicle.properties;
    const isWaiting = p.state_position === 'before_track' || p.state_position === 'before_track_delayed';
    if (!isWaiting && p.state_position !== 'on_track' && p.state_position !== 'at_stop') return null;
    const trip = tripTimesOf(index, p.gtfs_trip_id);
    const stop = p.last_stop_id !== undefined ? index.stopIndex.get(p.last_stop_id) ?? -1 : -1;
    const atMs = p.origin_timestamp ? Date.parse(p.origin_timestamp) : NaN;
    if (!trip || Number.isNaN(atMs) || !hasPosition(vehicle.geometry.coordinates)) return null;

    const t = secondsOfDayIn(timeZone, atMs);
    if (isWaiting) return finalize(wrapDaySeconds(t - trip.dep[0]));
    let k = callIndex(trip, stop, t);
    if (k < 0 && p.state_position === 'on_track') k = legByPosition(trip, index.slice.coords, vehicle.geometry.coordinates);
    if (k < 0) return null;

    const last = trip.stops.length - 1;
    const isAtLastStop = k === last && (p.state_position === 'at_stop'
        || distance(index.slice.coords[trip.stops[last]], vehicle.geometry.coordinates) <= DELAY_ESTIMATE_CONFIG.AT_LAST_STOP_M);
    if (isAtLastStop && wrapDaySeconds(t - trip.arr[last]) > DELAY_ESTIMATE_CONFIG.FINISHED_GRACE_S) return null;

    let delay: number;
    if (p.state_position === 'at_stop') {
        const toArrival = wrapDaySeconds(t - trip.arr[k]);
        const toDeparture = wrapDaySeconds(t - trip.dep[k]);
        delay = toArrival < 0 ? toArrival : toDeparture > 0 ? toDeparture : 0;
    } else if (k === 0) {
        delay = wrapDaySeconds(t - trip.dep[0]);
    } else {
        const { coords } = index.slice;
        const progress = straightLineProgress(coords[trip.stops[k - 1]], coords[trip.stops[k]], vehicle.geometry.coordinates);
        const scheduled = trip.dep[k - 1] + (trip.arr[k] - trip.dep[k - 1]) * progress;
        delay = wrapDaySeconds(t - scheduled);
    }

    return finalize(delay);
}

/** Whole seconds, as other networks report them; null past the plausible maximum. */
function finalize(delay: number): number | null {
    if (!Number.isFinite(delay) || Math.abs(delay) > DELAY_ESTIMATE_CONFIG.MAX_DELAY_S) return null;
    return Math.round(DELAY_ESTIMATE_CONFIG.CLAMP_EARLY ? Math.max(0, delay) : delay);
}

/**
 * The app's own delay estimate for every vehicle of `collection` it can place on its trip, as trip patches.
 * Runs once per fleet poll; `withEstimatedPatches` lays them under the push channel's patches.
 */
export function estimateFleetDelays(
    collection: VehicleCollection | null | undefined,
    index: StopTimeIndex | null,
    timeZone: string,
    receivedAt: number,
): PatchIndex {
    const estimates: PatchIndex = new Map();
    if (!collection?.features.length || !index) return estimates;
    for (const f of collection.features) {
        const { gtfs_trip_id: tripId, vehicle_id: vehicleId, origin_timestamp } = f.properties;
        if (!tripId) continue;
        const delay = estimateDelay(f, index, timeZone);
        if (delay === null) continue;
        estimates.set(tripId, {
            tripId, vehicleId: vehicleId || undefined, delay,
            dataTimestamp: origin_timestamp ? Date.parse(origin_timestamp) : receivedAt, receivedAt, isEstimate: true,
        });
    }
    return estimates;
}

/**
 * The push channel's trip patches with the fleet's `estimates` added, so every consumer of push patches gets
 * them, over the backend's own coarser estimate. The push channel stays the authority: only a vehicle it has
 * sent no fresh delay for (not yet connected, or silent) gets one. Returns `byTripId` itself when nothing is added.
 */
export function withEstimatedPatches(estimates: PatchIndex, byTripId: PatchIndex, byVehicleId: PatchIndex): PatchIndex {
    const freshPush = (patch: StoredEnrichmentPatch | undefined, estimate: StoredEnrichmentPatch) =>
        patch && estimate.receivedAt - patch.receivedAt <= ENRICHMENT_CONFIG.SILENCE_TTL_MS ? patch : undefined;

    let merged: PatchIndex | null = null;
    for (const [tripId, estimate] of estimates) {
        const pushed = freshPush(byTripId.get(tripId), estimate) ?? (estimate.vehicleId ? freshPush(byVehicleId.get(estimate.vehicleId), estimate) : undefined);
        if (pushed?.delay != null) continue;
        merged ??= new Map(byTripId);
        // Carries the push patch's other fields (low floor, run), which this trip patch would otherwise hide.
        merged.set(tripId, { ...pushed, ...estimate });
    }
    return merged ?? byTripId;
}
