import { useQuery } from '@tanstack/react-query';
import type { PointOfSale } from '../../types/pointsOfSale';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useCities } from './useCities';
import { FRONTEND_CITIES_CONFIG } from '../../config/cities';
import { useRouteParams } from '../useRouteParams';

export function usePointsOfSale() {
    const showPointsOfSale = usePreferencesStore((s) => s.showPointsOfSale);
    const selectedCity = usePreferencesStore((s) => s.selectedCity);
    const { posId } = useRouteParams();

    const { data: citiesData } = useCities();
    const cityConfig = citiesData?.cities.find((c) => c.slug === selectedCity) || FRONTEND_CITIES_CONFIG[selectedCity];

    const hasPointsOfSale = Boolean(cityConfig?.hasPointsOfSale);
    const isEnabled = (showPointsOfSale || Boolean(posId)) && hasPointsOfSale;

    const dataUrl = `https://data.departs.app/${selectedCity}/points-of-sale.json`;

    return useQuery<PointOfSale[]>({
        queryKey: ['pointsOfSale', selectedCity],
        queryFn: async () => {
            const res = await fetch(dataUrl);
            if (!res.ok) {
                // Fallback to local dev static directory if remote static URL fails
                const localRes = await fetch(`/data/${selectedCity}/points-of-sale.json`);
                if (!localRes.ok) {
                    throw new Error(`Failed to fetch points of sale for ${selectedCity}: ${res.status}`);
                }
                return localRes.json();
            }
            return res.json();
        },
        enabled: isEnabled,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours (data updates ~monthly/weekly)
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days cache retention
    });
}
