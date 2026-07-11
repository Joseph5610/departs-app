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
 * Resolves static model types and air-conditioning status based on Brno (DPMB) registration numbers,
 * dynamically fetching a JSON array of ranges.
 */
export async function getDpmbVehicleMetadata(
    registrationNumber: string | number
): Promise<BrnoVehicleMetadata | null> {
    const config = getCityConfig('brno');
    const staticDataUrl = config?.adapterConfig?.staticDataUrl;
    if (!staticDataUrl) return null;

    // Bust the cache with a query param and new cache key since the 404 was cached
    const dpmbUrl = `${staticDataUrl}/brno/dpmb-vehicles.json?v=2`;
    const ranges = await CacheManager.getOrFetch<DpmbVehicleRange[] | null>(
        `dpmb_vehicles_brno_v2`, 
        CACHE_TTL.TWO_HOURS_MS, 
        async () => {
            const resApi = await appClient.fetch(dpmbUrl, { cf: { cacheTtl: 7200 } });
            if (!resApi.ok) return null;
            return await resApi.json();
        }
    );

    if (!ranges || ranges.length === 0) return null;

    // Remove any non-numeric prefixes/suffixes from vehicle ID (e.g., "dpmb-7696" or "3|7696" -> "7696")
    const cleanId = String(registrationNumber).match(/\d{3,4}/)?.[0] || '';
    const num = parseInt(cleanId, 10);
    if (isNaN(num)) return null;

    const match = ranges.find(r => num >= r.min && num <= r.max);
    
    if (match) {
        return {
            vehicle_type: match.vehicle_type,
            is_air_conditioned: match.is_air_conditioned
        };
    }

    return null;
}
