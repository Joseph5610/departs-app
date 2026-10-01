import '../../lib/zod-config';
import { z } from 'zod/mini';
import { useQueries } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';
import { memoizeLast } from '../../lib/memoize';
import { createDevicePersister, deviceCacheStaleTime } from '../../lib/deviceCache';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '../../config/constants';
import type { NetworkCoverage } from '../../types/cities';
import { useVisibleCities } from './useCities';

const coverageSchema = z.object({
    cell: z.number().check(z.positive()),
    cells: z.record(z.string(), z.number()),
});

const coveragePersister = createDevicePersister((data): NetworkCoverage => coverageSchema.parse(data));

const toMap = memoizeLast((...entries: Array<[string, NetworkCoverage | undefined]>): ReadonlyMap<string, NetworkCoverage> => {
    const map = new Map<string, NetworkCoverage>();
    for (const [slug, coverage] of entries) if (coverage) map.set(slug, coverage);
    return map;
});

/**
 * Where each network the user can pick has stops, by slug, from its `coverage.json` on the static
 * data CDN. A few kilobytes each, kept on the device. A network without the file is never overlaid or
 * switched to, so the map stays on the selected city until departs-data publishes it.
 */
export function useNetworkCoverage(): ReadonlyMap<string, NetworkCoverage> {
    const cities = useVisibleCities();
    const results = useQueries({
        queries: cities.map(city => ({
            queryKey: ['coverage', city.slug],
            queryFn: async () => coverageSchema.parse(await apiFetch<unknown>(`${EXTERNAL_URLS.STATIC_DATA}/${city.slug}/coverage.json`)),
            staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.STATIC_METADATA_STALE),
            gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
            persister: coveragePersister,
            retry: false,
        })),
    });
    return toMap(...cities.map((city, i): [string, NetworkCoverage | undefined] => [city.slug, results[i]?.data]));
}
