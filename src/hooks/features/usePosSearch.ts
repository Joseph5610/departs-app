import { useMemo, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { usePointsOfSale } from '../data/usePointsOfSale';
import { useCityConfig } from '../data/useCities';
import { useGeolocationStore } from '../../state/geolocationStore';
import { createPosSearchIndex, searchPointsOfSale, type PosSearchResult } from '../../utils/posSearch';
import { POINT_OF_SALE_TYPES, type PointOfSaleType } from '../../types/pointsOfSale';

/** Searches the selected city's points of sale; `isActive` loads the list once the search is in use. */
export const usePosSearch = (query: string, isActive: boolean): PosSearchResult[] => {
    const { t } = useTranslation();
    const deferredQuery = useDeferredValue(query);

    const { data: posList } = usePointsOfSale(isActive);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const cityCenter = useCityConfig().center;

    const typeLabels = useMemo(() => {
        const labels = {} as Record<PointOfSaleType, string>;
        for (const type of POINT_OF_SALE_TYPES) labels[type] = t(`pos.types.${type}`, type);
        return labels;
    }, [t]);

    const index = useMemo(
        () => (posList ? createPosSearchIndex(posList, typeLabels) : []),
        [posList, typeLabels]
    );

    return useMemo(
        () => searchPointsOfSale(index, deferredQuery, userLocation ?? cityCenter),
        [index, deferredQuery, userLocation, cityCenter]
    );
};
