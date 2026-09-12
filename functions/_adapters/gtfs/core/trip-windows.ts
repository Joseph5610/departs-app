import type { CityConfig } from '../../../_core/city-config';
import { UPSTREAM_TTL_S } from '../../../_core/config';
import { appClient } from '../../../_core/ApiClient';
import { CacheManager, MEMORY_CACHE_TTL } from '../../../_core/utils/CacheManager';

/**
 * A trip's operating window: `[start_mins, end_mins, dayFlags, direction_id?]`.
 *
 * `dayFlags` is a bitmask over `TripWindows.days`; `-1` means the trip carries no date
 * restriction and should be treated as operating on any day. `direction_id` is only emitted by
 * networks whose realtime feed has to be matched to trips by schedule (Prešov).
 */
export type TripWindow = [number, number, number] | [number, number, number, number];

export interface TripWindows {
    days: string[];
    trips: Record<string, TripWindow>;
}

/**
 * Fetches the compact trip operating windows (`trip_windows.json`) for a city.
 *
 * Keyed by trip_id, so it needs no lookup build, and it carries only the fields actually read.
 */
export async function getTripWindows(city: CityConfig): Promise<TripWindows | null> {
    const staticUrl = city.adapterConfig?.staticDataUrl;
    if (!staticUrl) return null;

    const url = `${staticUrl}/${city.slug}/trip_windows.json`;

    return CacheManager.getOrFetch<TripWindows | null>(
        `trip_windows_${city.slug}`,
        MEMORY_CACHE_TTL.TWO_HOURS_MS,
        async () => {
            try {
                const res = await appClient.fetch(url, { cf: { cacheTtl: UPSTREAM_TTL_S.SCHEDULE_DATA } });
                if (!res.ok) {
                    console.error(`Failed to fetch trip_windows.json for ${city.slug}: ${res.status}`);
                    return null;
                }
                return JSON.parse(await res.text()) as TripWindows;
            } catch (e) {
                console.error("Failed to fetch trip_windows.json", e);
                return null;
            }
        },
        (data) => !data || Object.keys(data.trips).length === 0
    );
}

/**
 * Resolves the bit representing `dayStr` within a windows file, or 0 when the file does not
 * cover that day - in which case no trip matches.
 */
export function dayBit(windows: TripWindows, dayStr: string): number {
    const idx = windows.days.indexOf(dayStr);
    return idx < 0 ? 0 : 1 << idx;
}

/** Whether a trip operates on the day represented by `bit`. */
export function operatesOnDay(window: TripWindow, bit: number): boolean {
    const flags = window[2];
    return flags === -1 || (flags & bit) !== 0;
}
