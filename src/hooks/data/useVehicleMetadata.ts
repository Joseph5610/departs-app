import '../../lib/zod-config';
import { z } from 'zod/mini';
import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '../../state/preferencesStore';
import { apiFetch } from '../../lib/api-client';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '../../config/constants';
import { memoizeLast } from '../../lib/memoize';
import { useCityConfig } from './useCities';
import type { FleetLookup, VehicleMetadata } from '../../types/vehicles';

/** The register groups contiguous vehicle-number ranges under the operator that runs them. */
const fleetFileSchema = z.record(z.string(), z.array(z.object({
    min: z.number(),
    max: z.number(),
    vehicle_type: z.string(),
    is_air_conditioned: z.optional(z.boolean()),
    is_wheelchair_accessible: z.optional(z.boolean()),
})));

interface FleetRange extends VehicleMetadata {
    min: number;
    max: number;
}

/** Ranges sorted by `min`, for a binary search by vehicle number. */
const buildRanges = memoizeLast((file: z.infer<typeof fleetFileSchema>): FleetRange[] =>
    Object.entries(file)
        .flatMap(([operator, ranges]) => ranges.map(range => ({ ...range, operator })))
        .sort((a, b) => a.min - b.min));

/** The range holding `vehicleNumber`, if any. */
function findRange(ranges: FleetRange[], vehicleNumber: number): FleetRange | undefined {
    let low = 0;
    let high = ranges.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const range = ranges[mid];
        if (vehicleNumber < range.min) high = mid - 1;
        else if (vehicleNumber > range.max) low = mid + 1;
        else return range;
    }
    return undefined;
}

/** One lookup per loaded register, so memoized consumers see a stable function. */
const buildLookup = memoizeLast((ranges: FleetRange[], operator: string): FleetLookup => {
    const unlisted: VehicleMetadata = { operator };
    return (vehicleId) => {
        if (!vehicleId) return undefined;
        const vehicleNumber = Number(vehicleId);
        return (Number.isFinite(vehicleNumber) ? findRange(ranges, vehicleNumber) : undefined) ?? unlisted;
    };
});

const NO_RANGES: FleetRange[] = [];

/**
 * Operator, model and equipment by vehicle id, from the city's fleet register on the static data CDN.
 * Undefined for a city without a register.
 */
export function useFleetLookup(): FleetLookup | undefined {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const source = useCityConfig().vehicleMetadata;

    const { data: ranges } = useQuery({
        queryKey: ['vehicle-metadata', selectedCity, source?.file],
        queryFn: async () => fleetFileSchema.parse(await apiFetch<unknown>(`${EXTERNAL_URLS.STATIC_DATA}/${selectedCity}/${source!.file}`)),
        enabled: !!selectedCity && !!source,
        select: buildRanges,
        staleTime: QUERY_TIMING_MS.TRIP_SHAPES_STALE,
        gcTime: QUERY_TIMING_MS.TRIP_SHAPES_GC,
    });

    return source ? buildLookup(ranges ?? NO_RANGES, source.operator) : undefined;
}
