import '@/lib/zodConfig';
import { z } from 'zod/mini';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useCityConfig } from './useCities';
import { apiFetch } from '@/lib/apiClient';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '@/config/constants';
import { EMPTY_ROUTE_METADATA, indexRouteMetadata, NO_TYPE_COLORS, type RouteMetadata, type RouteTypeColors } from '@/domain/routes';
import type { RouteInfo } from '@/types';
import { createDevicePersister, deviceCacheStaleTime } from '@/lib/deviceCache';
import { queryKeys } from '@/lib/queryKeys';

const routesFileSchema = z.record(z.string(), z.object({
    name: z.string(),
    type: z.string(),
    route_color: z.string(),
}));

const routesPersister = createDevicePersister((data) => routesFileSchema.parse(data));

/** Per routes file, so every observer of a city gets the same lookups, which downstream `memoizeLast` pipelines key on. */
const built = new WeakMap<Record<string, RouteInfo>, { typeColors: RouteTypeColors; metadata: RouteMetadata }>();

export const buildRouteMetadata = (data: Record<string, RouteInfo>, typeColors: RouteTypeColors): RouteMetadata => {
    const existing = built.get(data);
    if (existing?.typeColors === typeColors) return existing.metadata;
    const metadata = indexRouteMetadata(data, typeColors);
    built.set(data, { typeColors, metadata });
    return metadata;
};

export const routesQueryOptions = (city: string) => queryOptions({
    queryKey: queryKeys.routeMetadata(city),
    queryFn: async () => routesFileSchema.parse(await apiFetch<unknown>(`${EXTERNAL_URLS.STATIC_DATA}/${city}/routes.json`)),
    staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.STATIC_METADATA_STALE),
    gcTime: QUERY_TIMING_MS.STATIC_METADATA_GC,
    persister: routesPersister,
});

/**
 * A city's route branding (name/color), read straight from the static data CDN - the same file the
 * backend's own `routesByName` lookup reads, fetched directly instead of embedded in API responses.
 * For the selected city unless `city` names another; null reads nothing.
 */
export function useRouteMetadata(city?: string | null): RouteMetadata {
    const ownCity = usePreferencesStore(s => s.selectedCity);
    const selectedCity = city === undefined ? ownCity : city;
    const typeColors = useCityConfig(selectedCity ?? undefined).routeTypeColors ?? NO_TYPE_COLORS;

    const { data } = useQuery({ ...routesQueryOptions(selectedCity ?? ''), enabled: !!selectedCity });

    return data ? buildRouteMetadata(data, typeColors) : EMPTY_ROUTE_METADATA;
}
