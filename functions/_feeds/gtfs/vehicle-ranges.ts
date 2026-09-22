import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { appClient } from '../../_core/ApiClient';
import type { CityConfig } from '../../_core/city-config';
import { UPSTREAM_TTL_S } from '../../_core/config';

/** Static fleet metadata for a contiguous block of vehicle numbers, one operator's fleet. */
export interface VehicleRange {
    min: number;
    max: number;
    vehicle_type: string;
    operator: string;
    is_air_conditioned?: boolean;
    is_wheelchair_accessible?: boolean;
}

type RawVehicleRange = Omit<VehicleRange, 'operator'>;

/** The metadata file: ranges grouped under the operator that runs them, e.g. `{ "DPMB": [...], "České dráhy": [...] }`. */
type VehicleRangesFile = Record<string, RawVehicleRange[]>;

/**
 * Fetches a city's fleet metadata ranges (`feed.vehicleMetadataFile`) from the static
 * data CDN, sorted by `min` for `findVehicleRange`. Null when the city has none configured.
 */
export async function getVehicleRanges(city: CityConfig): Promise<VehicleRange[] | null> {
    const staticDataUrl = city.feed?.staticDataUrl;
    const fileName = city.feed?.vehicleMetadataFile;
    if (!staticDataUrl || !fileName) return null;

    return CacheManager.getOrFetch<VehicleRange[] | null>(
        `vehicle_ranges_${city.slug}_${fileName}`,
        MEMORY_CACHE_TTL.TWO_HOURS_MS,
        async () => {
            const res = await appClient.fetch(`${staticDataUrl}/${city.slug}/${fileName}`, { cf: { cacheTtl: UPSTREAM_TTL_S.SCHEDULE_DATA } });
            if (!res.ok) return null;
            const data = await res.json() as VehicleRangesFile;
            const ranges: VehicleRange[] = [];
            for (const operator in data) {
                for (const range of data[operator]) {
                    ranges.push({ ...range, operator });
                }
            }
            return ranges.sort((a, b) => a.min - b.min);
        },
        (ranges) => !ranges || ranges.length === 0
    );
}

/** Binary search for the range containing `num`. Expects ranges sorted by `min`. */
export function findVehicleRange(num: number, sortedRanges: VehicleRange[]): VehicleRange | null {
    let low = 0;
    let high = sortedRanges.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const range = sortedRanges[mid];
        if (num >= range.min && num <= range.max) {
            return range;
        } else if (num < range.min) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }
    return null;
}
