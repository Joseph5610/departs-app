import { useQuery } from '@tanstack/react-query';
import { pointOfSaleSchema, type PointOfSale } from '../../types/pointsOfSale';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useCityConfig } from './useCities';
import { EXTERNAL_URLS, QUERY_TIMING_MS } from '../../config/constants';
import { useRouteParams } from '../useRouteParams';

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

export function usePointsOfSale() {
    const showPointsOfSale = usePreferencesStore((s) => s.showPointsOfSale);
    const selectedCity = usePreferencesStore((s) => s.selectedCity);
    const { posId } = useRouteParams();

    const hasPointsOfSale = Boolean(useCityConfig().hasPointsOfSale);
    const isEnabled = (showPointsOfSale || Boolean(posId)) && hasPointsOfSale;

    const dataUrl = `${EXTERNAL_URLS.STATIC_DATA}/${selectedCity}/points-of-sale.json`;

    return useQuery<PointOfSale[]>({
        queryKey: ['pointsOfSale', selectedCity],
        queryFn: async () => {
            const res = await fetch(dataUrl);
            if (!res.ok) {
                if (!import.meta.env.DEV) throw new Error(`Failed to fetch points of sale for ${selectedCity}: ${res.status}`);
                const localRes = await fetch(`/data/${selectedCity}/points-of-sale.json`);
                if (!localRes.ok) {
                    throw new Error(`Failed to fetch points of sale for ${selectedCity}: ${res.status}`);
                }
                return parsePointsOfSale(await localRes.json());
            }
            return parsePointsOfSale(await res.json());
        },
        enabled: isEnabled,
        staleTime: QUERY_TIMING_MS.POINTS_OF_SALE_STALE,
        gcTime: QUERY_TIMING_MS.POINTS_OF_SALE_GC,
    });
}
