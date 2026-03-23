import { useState, useMemo, useDeferredValue } from 'react';
import type { StopFeature } from '../../types/transit';
import { createSearchIndex, searchStops } from '../../utils/searchAlgorithm';

export const useStopSearch = (stops: { features: StopFeature[] } | null) => {
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);

    // 1. Pre-calculate search index (run only once when stops load)
    const searchIndex = useMemo(() => {
        if (!stops?.features) return [];
        return createSearchIndex(stops.features);
    }, [stops]);

    // 2. Search logic (runs when query changes, but using pre-calculated index)
    const results = useMemo(() => {
        return searchStops(searchIndex, deferredQuery);
    }, [searchIndex, deferredQuery]);

    return {
        query,
        setQuery,
        results
    };
};
