import '@/lib/zodConfig';
import { z } from 'zod/mini';
import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '@/state/preferencesStore';
import { apiFetch } from '@/lib/apiClient';
import { DEVICE_CACHE, EXTERNAL_URLS, QUERY_TIMING_MS } from '@/config/constants';
import { memoizeLast } from '@/lib/memoize';
import { createDevicePersister, deviceCacheStaleTime } from '@/lib/deviceCache';
import { useCityConfig } from './useCities';
import type { FleetLookup } from '@/types';
import { fleetLookup, fleetRanges, type FleetRange } from '@/domain/vehicles';
import { queryKeys } from '@/lib/queryKeys';

/** The register groups contiguous vehicle-number ranges under the operator that runs them. */
const fleetFileSchema = z.record(z.string(), z.array(z.object({
    min: z.number(),
    max: z.number(),
    vehicle_type: z.string(),
    is_air_conditioned: z.optional(z.boolean()),
    is_wheelchair_accessible: z.optional(z.boolean()),
})));

const fleetPersister = createDevicePersister((data) => fleetFileSchema.parse(data));

/** Ranges sorted once per loaded register. */
const buildRanges = memoizeLast(fleetRanges);

/** One lookup per loaded register, so memoized consumers see a stable function. */
const buildLookup = memoizeLast(fleetLookup);

const NO_RANGES: FleetRange[] = [];

/**
 * Operator, model and equipment by vehicle id, from the city's fleet register on the static data CDN.
 * Undefined for a city without a register.
 */
export function useFleetLookup(): FleetLookup | undefined {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const source = useCityConfig().vehicleMetadata;

    const { data: ranges } = useQuery({
        queryKey: queryKeys.vehicleMetadata(selectedCity, source?.file),
        queryFn: async () => fleetFileSchema.parse(await apiFetch<unknown>(`${EXTERNAL_URLS.STATIC_DATA}/${selectedCity}/${source!.file}?v=${DEVICE_CACHE.VERSION}`)),
        enabled: !!selectedCity && !!source,
        select: buildRanges,
        staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.STATIC_METADATA_STALE),
        gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
        persister: fleetPersister,
    });

    return source ? buildLookup(ranges ?? NO_RANGES) : undefined;
}
