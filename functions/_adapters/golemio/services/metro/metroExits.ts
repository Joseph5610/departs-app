import type { AppMetroExits, AppVehicleDetail } from "../../../../_core/types";
import { GOLEMIO_CONFIG } from "../../core/config";
import { UPSTREAM_TTL_S } from "../../../../_core/config";
import { CacheManager, MEMORY_CACHE_TTL } from "../../../../_core/utils/CacheManager";
import { appClient } from '../../../../_core/ApiClient';

interface MetroPlatformExits {
    exits: Array<[string, string | null, number[]]>;
    stepFree?: [string, number[]];
}

/** `prague/metro-exits.json`, built by departs-data from the PID GTFS. */
interface MetroExitsFile {
    /** `line|station|>next` or `line|station|<previous` -> platform stop id. */
    keys: Record<string, string>;
    platforms: Record<string, MetroPlatformExits>;
}

/** Fetches the metro exits file once per isolate; null when unavailable. */
export async function getMetroExits(): Promise<MetroExitsFile | null> {
    return CacheManager.getOrFetch('prague_metro_exits', MEMORY_CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const res = await appClient.fetch(GOLEMIO_CONFIG.METRO_EXITS_DATA_URL, {
                cf: { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA }
            });
            if (!res.ok) {
                console.error("Failed to fetch Prague metro exits:", res.status);
                return null;
            }
            return JSON.parse(await res.text()) as MetroExitsFile;
        } catch (e) {
            console.error("Failed to load Prague metro exits:", e);
            return null;
        }
    }, (data) => !data);
}

/**
 * Sets `metro_exits` on each station of a metro trip. The trip detail names stations but not
 * platforms, so the direction comes from the neighbouring station on the same trip.
 */
export function attachMetroExits(detail: AppVehicleDetail, file: MetroExitsFile | null): void {
    const features = detail.stop_times?.features;
    if (!file || !features || detail.route_type !== 'metro') return;

    const line = detail.route_short_name;
    for (let i = 0; i < features.length; i++) {
        const name = features[i]!.properties.stop_name;
        const next = features[i + 1]?.properties.stop_name;
        const prev = features[i - 1]?.properties.stop_name;
        const platform = (next && file.keys[`${line}|${name}|>${next}`]) || (prev && file.keys[`${line}|${name}|<${prev}`]);
        const exits = platform ? file.platforms[platform] : undefined;
        if (!exits) continue;

        const mapped: AppMetroExits = {
            exits: exits.exits.map(([exitName, hint, cars]) => ({ name: exitName, ...(hint ? { hint } : {}), cars })),
            ...(exits.stepFree ? { step_free: { name: exits.stepFree[0], cars: exits.stepFree[1] } } : {}),
        };
        features[i]!.properties.metro_exits = mapped;
    }
}
