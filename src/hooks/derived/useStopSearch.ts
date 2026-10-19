import { useState, useMemo, useDeferredValue } from 'react';
import type { StopModel } from '@/types';
import { createSearchIndex, searchStops } from '@/domain/stops';

export const useStopSearch = (model: StopModel | null) => {
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);

    const searchIndex = useMemo(() => {
        if (!model) return [];
        return createSearchIndex([...model.stations, ...model.platforms]);
    }, [model]);

    const results = useMemo(() => {
        return searchStops(searchIndex, deferredQuery);
    }, [searchIndex, deferredQuery]);

    return {
        query,
        setQuery,
        results,
        searchIndex
    };
};
