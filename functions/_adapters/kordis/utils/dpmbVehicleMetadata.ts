import { CacheManager, CACHE_TTL } from '../../../_core/utils/CacheManager';
import { appClient } from '../../../_core/ApiClient';
import { getCityConfig } from '../../../_core/city-config';

export interface BrnoVehicleMetadata {
    vehicle_type: string;
    is_air_conditioned?: boolean;
}

export interface DpmbVehicleRange extends BrnoVehicleMetadata {
    min: number;
    max: number;
}

/**
 * Fetches the static DPMB vehicle metadata ranges from the CDN.
 * This is used for bulk enrichment of the real-time vehicle feed to inject
 * static features like air-conditioning availability and specific vehicle model types.
 */
export async function getDpmbVehicleRanges(): Promise<DpmbVehicleRange[] | null> {
    const config = getCityConfig('brno');
    const staticDataUrl = config?.adapterConfig?.staticDataUrl;
    if (!staticDataUrl) return null;

    const dpmbUrl = `${staticDataUrl}/brno/dpmb-vehicles.json?v=2`;
    return CacheManager.getOrFetch<DpmbVehicleRange[] | null>(
        `dpmb_vehicles_brno_v2`, 
        CACHE_TTL.TWO_HOURS_MS,
        async () => {
            const resApi = await appClient.fetch(dpmbUrl, { cf: { cacheTtl: 7200 } });
            if (!resApi.ok) return null;
            const data = await resApi.json() as DpmbVehicleRange[];
            return data.sort((a, b) => a.min - b.min);
        }
    );
}

/**
 * Binary search to find a matching DPMB vehicle range for a given vehicle number.
 * Expects ranges to be sorted by `min`.
 */
export function findDpmbRange(num: number, sortedRanges: DpmbVehicleRange[]): DpmbVehicleRange | null {
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
