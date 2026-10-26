import type { AppVehicleDetail } from '../../_core/types';

/** A simulated trip for the watch's tests: what its vehicle-detail read answers at any moment. */

export const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);
export const MIN = 60_000;
const STOPS = [1, 2, 3, 4, 5, 6];
const DWELL_MS = 30_000;

/** A trip whose stop `n` is timetabled `n * 4` min after NOW, run late by `delayMin`, read through failures and stalls. */
export interface World {
    delayMin?: number;
    /** Reads failing in these windows (ms from NOW, inclusive start, exclusive end). */
    failing?: [number, number][];
    /** The live position stops updating from this moment (ms from NOW). */
    stallAt?: number;
    /** The feed reports the trip cancelled from this moment (ms from NOW). */
    cancelAt?: number;
    /** No live position at all: the feed answers the timetable only. */
    timetableOnly?: boolean;
    /** The vehicle leaves the feed from this moment (ms from NOW): the trip answers its timetable only. */
    vanishAt?: number;
}

export const scheduledAt = (sequence: number) => NOW + sequence * 4 * MIN;
const actualAt = (world: World, sequence: number) => scheduledAt(sequence) + (world.delayMin ?? 0) * MIN;

const stopTimes = { features: STOPS.map(stop_sequence => ({ type: 'Feature' as const, properties: { stop_id: `s${stop_sequence}`, stop_name: `Stop ${stop_sequence}`, stop_sequence, arrival_time: '12:00:00', departure_time: '12:00:00' } })) };

const TRIP: Pick<AppVehicleDetail, 'gtfs_trip_id' | 'route_short_name' | 'route_type' | 'bearing'> = { gtfs_trip_id: 'trip-1', route_short_name: '22', route_type: 'tram', bearing: 0 };

/** What the vehicle-detail API answers at `at`; null for a failed read. */
export const read = (world: World, at: number): AppVehicleDetail | null => {
    const offset = at - NOW;
    if (world.failing?.some(([from, to]) => offset >= from && offset < to)) return null;
    if (world.cancelAt !== undefined && offset >= world.cancelAt) return { ...TRIP, state_position: 'canceled', last_stop_sequence: null, stop_times: stopTimes, delay: null };
    if (world.timetableOnly || (world.vanishAt !== undefined && offset >= world.vanishAt)) return { ...TRIP, is_static_fallback: true, state_position: 'unknown', last_stop_sequence: null, stop_times: stopTimes, delay: null };
    const seen = world.stallAt !== undefined ? Math.min(at, NOW + world.stallAt) : at;
    const passed = STOPS.filter(sequence => actualAt(world, sequence) <= seen);
    const last = passed.at(-1) ?? null;
    if (last === null) return { ...TRIP, state_position: 'before_track', last_stop_sequence: null, stop_times: stopTimes, delay: (world.delayMin ?? 0) * 60 };
    const atStop = seen - actualAt(world, last) < DWELL_MS || last === STOPS.at(-1);
    return { ...TRIP, state_position: atStop ? 'at_stop' : 'on_track', last_stop_sequence: last, stop_times: stopTimes, delay: (world.delayMin ?? 0) * 60 };
};
