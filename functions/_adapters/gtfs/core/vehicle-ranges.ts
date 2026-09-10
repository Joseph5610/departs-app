import { CacheManager, CACHE_TTL } from '../../../_core/utils/CacheManager';
import { appClient } from '../../../_core/ApiClient';
import type { CityConfig } from '../../../_core/city-config';

/** Static fleet metadata for a contiguous block of vehicle numbers. */
export interface VehicleRange {
    min: number;
    max: number;
    vehicle_type: string;
    is_air_conditioned?: boolean;
    is_wheelchair_accessible?: boolean;
}

/**
 * Fetches a city's fleet metadata ranges (`adapterConfig.vehicleMetadataFile`) from the static
 * data CDN, sorted by `min` for `findVehicleRange`. Null when the city has none configured.
 */
export async function getVehicleRanges(city: CityConfig): Promise<VehicleRange[] | null> {
    const staticDataUrl = city.adapterConfig?.staticDataUrl;
    const fileName = city.adapterConfig?.vehicleMetadataFile;
    if (!staticDataUrl || !fileName) return null;

    return CacheManager.getOrFetch<VehicleRange[] | null>(
        `vehicle_ranges_${city.slug}_${fileName}`,
        CACHE_TTL.TWO_HOURS_MS,
        async () => {
            const res = await appClient.fetch(`${staticDataUrl}/${city.slug}/${fileName}`, { cf: { cacheTtl: 7200 } });
            if (!res.ok) return null;
            const data = await res.json() as VehicleRange[];
            return data.sort((a, b) => a.min - b.min);
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
