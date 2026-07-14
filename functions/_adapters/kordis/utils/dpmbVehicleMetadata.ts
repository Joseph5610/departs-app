import { CacheManager, CACHE_TTL } from '../../../_core/utils/CacheManager';
import { appClient } from '../../../_core/ApiClient';
import { getCityConfig } from '../../../_core/city-config';

export interface BrnoVehicleMetadata {
    vehicle_type: string;
    is_air_conditioned?: boolean;
}

interface DpmbVehicleRange extends BrnoVehicleMetadata {
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
            return await resApi.json();
        }
    );
}

/**
 * Resolves static model types and air-conditioning status for a single vehicle
 * based on Brno (DPMB) registration numbers by fetching and parsing the JSON array of ranges.
 */
export async function getDpmbVehicleMetadata(
    registrationNumber: string | number
): Promise<BrnoVehicleMetadata | null> {
    const ranges = await getDpmbVehicleRanges();

    if (!ranges || ranges.length === 0) return null;

    const num = parseInt(String(registrationNumber), 10);
    if (isNaN(num)) return null;

    const rangeMatch = ranges.find(r => num >= r.min && num <= r.max);
    
    if (rangeMatch) {
        return {
            vehicle_type: rangeMatch.vehicle_type,
            is_air_conditioned: rangeMatch.is_air_conditioned
        };
    }

    return null;
}
