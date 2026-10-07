import { useState, useMemo, useDeferredValue } from 'react';
import type { StopFeature } from '@/types';
import { createSearchIndex, searchStops } from '@/domain/stops';

export const useStopSearch = (stops: { features: StopFeature[] } | null) => {
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);

    const searchIndex = useMemo(() => {
        if (!stops?.features) return [];
        return createSearchIndex(stops.features);
    }, [stops]);

    const results = useMemo(() => {
        return searchStops(searchIndex, deferredQuery);
    }, [searchIndex, deferredQuery]);

    return {
        query,
        setQuery,
        results
    };
};
