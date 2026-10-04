import type { CityConfig } from '../../_core/city-config';
import { UPSTREAM_TTL_S, STATIC_DATA_CONFIG } from '../../_core/config';
import { appClient } from '../../_core/ApiClient';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { isFields } from '../../_core/utils/fields';
import { DAY_MINS, type LocalClock } from '../../_core/utils/time';
import { GTFS_CONFIG } from './config';

/** `[start_mins, end_mins, dayFlags, routeIndex]`, plus `direction_id` for networks matched by schedule (Prešov). */
export type ScheduleTrip = [number, number, number, number] | [number, number, number, number, number];

/** `schedule/<HH>.json`: every trip a vehicle may be matched to during that hour (departs-data `buildScheduleFiles`). */
export interface Schedule {
    /** YYYYMMDD service days the `dayFlags` bitmasks refer to. */
    days: string[];
    /** Route ids, referenced by a trip's `routeIndex`. */
    routes: string[];
    trips: Record<string, ScheduleTrip>;
}

const isSchedule = (v: unknown): v is Schedule =>
    isFields(v) && Array.isArray(v.days) && Array.isArray(v.routes) && isFields(v.trips);

/** The trips a vehicle may be matched to at `clock`, from the hour's schedule file; null when it cannot be read. */
export async function getSchedule(city: CityConfig, clock: LocalClock): Promise<Schedule | null> {
    const hour = String(Math.floor(clock.mins / 60)).padStart(2, '0');
    return CacheManager.getOrFetch<Schedule | null>(
        `schedule_${city.slug}_${hour}`,
        MEMORY_CACHE_TTL.TWO_HOURS_MS,
        async () => {
            try {
                const res = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${city.slug}/schedule/${hour}.json`, { cacheTtl: UPSTREAM_TTL_S.SCHEDULE_DATA, cf: { cacheTtl: UPSTREAM_TTL_S.SCHEDULE_DATA } });
                if (!res.ok) {
                    console.error(`Failed to fetch schedule/${hour}.json for ${city.slug}: ${res.status}`);
                    return null;
                }
                const schedule: unknown = JSON.parse(await res.text());
                if (!isSchedule(schedule)) {
                    console.error(`Malformed schedule/${hour}.json for ${city.slug}`);
                    return null;
                }
                return schedule;
            } catch (e) {
                console.error(`Failed to fetch schedule/${hour}.json for ${city.slug}`, e);
                return null;
            }
        },
        (data) => !data
    );
}

/** The trip's route id; undefined for a trip without one or not in this hour's schedule. */
export function routeIdOf(schedule: Schedule, tripId: string): string | undefined {
    const trip = schedule.trips[tripId];
    return trip && trip[3] >= 0 ? schedule.routes[trip[3]] : undefined;
}

/**
 * Whether a vehicle may be on this trip at `mins`, today's service or yesterday's run past midnight:
 * the one rule every network matches by, so a vehicle reporting a trip hours from its timetable is not shown.
 */
export function isWithinMatchWindow(trip: readonly number[], mins: number, offsetMins?: number): boolean {
    const { BEFORE_MINS, AFTER_MINS } = GTFS_CONFIG.SCHEDULE_MATCH_WINDOW;
    const fits = (offset: number) => mins >= trip[0] + offset - BEFORE_MINS && mins <= trip[1] + offset + AFTER_MINS;
    return offsetMins !== undefined ? fits(offsetMins) : fits(0) || fits(-DAY_MINS);
}

/**
 * Whether a vehicle is waiting to start its trip: it has not passed the first stop (where the feed says
 * which stop it reached) and the trip departs within `BEFORE_TRACK_WINDOW_MINS`, though not in the last minute.
 */
export function isWaitingToStart(minsToStart: number, reachedStopSequence?: number | null): boolean {
    if (reachedStopSequence != null && reachedStopSequence > 1) return false;
    return minsToStart > 1 && minsToStart <= GTFS_CONFIG.BEFORE_TRACK_WINDOW_MINS;
}

/**
 * Resolves the bit representing `dayStr` within a schedule's or a trip bucket's `days`, or 0 when they
 * do not cover that day - in which case no trip matches.
 */
export function dayBit(file: { days: string[] }, dayStr: string): number {
    const idx = file.days.indexOf(dayStr);
    return idx < 0 ? 0 : 1 << idx;
}

/** Whether a trip operates on the day represented by `bit`. */
export function operatesOnDay(trip: readonly number[], bit: number): boolean {
    return flagsInclude(trip[2], bit);
}

/** Whether `dayFlags` include the day represented by `bit`; `-1` means no date restriction. */
export function flagsInclude(dayFlags: number, bit: number): boolean {
    return dayFlags === -1 || (dayFlags & bit) !== 0;
}
