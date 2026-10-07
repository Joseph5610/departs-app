import { useQuery } from '@tanstack/react-query';
import { pointOfSaleSchema, type PointOfSale } from '@/types';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useCityConfig } from './useCities';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '@/config/constants';
import { apiFetch } from '@/lib/apiClient';
import { useRouteParams } from '@/hooks/useRouteParams';
import { createDevicePersister, deviceCacheStaleTime } from '@/lib/deviceCache';
import { queryKeys } from '@/lib/queryKeys';

/** Validates each entry on its own, so one malformed point of sale is dropped instead of the whole list. */
const parsePointsOfSale = (json: unknown): PointOfSale[] => {
    if (!Array.isArray(json)) throw new Error('Points of sale: expected an array');
    const valid: PointOfSale[] = [];
    for (const entry of json) {
        const parsed = pointOfSaleSchema.safeParse(entry);
        if (parsed.success) valid.push(parsed.data);
    }
    return valid;
};

const pointsOfSalePersister = createDevicePersister(parsePointsOfSale);

/** `preload` lets the search load the list while the map layer is still hidden. */
export function usePointsOfSale(preload = false) {
    const showPointsOfSale = usePreferencesStore((s) => s.showPointsOfSale);
    const selectedCity = usePreferencesStore((s) => s.selectedCity);
    const { posId } = useRouteParams();

    const cityConfig = useCityConfig();
    const hasPointsOfSale = Boolean(cityConfig.hasPointsOfSale);
    const isEnabled = (showPointsOfSale || preload || Boolean(posId)) && hasPointsOfSale;

    const dataUrl = `${EXTERNAL_URLS.STATIC_DATA}/${selectedCity}/points-of-sale.json`;

    return useQuery<PointOfSale[]>({
        queryKey: queryKeys.pointsOfSale(selectedCity),
        queryFn: async () => parsePointsOfSale(await apiFetch<unknown>(dataUrl)),
        enabled: isEnabled,
        staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.POINTS_OF_SALE_STALE),
        gcTime: QUERY_TIMING_MS.POINTS_OF_SALE_GC,
        persister: pointsOfSalePersister,
    });
}
