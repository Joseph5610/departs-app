import { useState, useMemo, useDeferredValue } from 'react';
import { normalizeString } from '../utils/stringUtils';
import type { StopFeature } from '../types/transit';

export const useStopSearch = (stops: { features: StopFeature[] } | null) => {
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);

    // 1. Pre-calculate search index (run only once when stops load)
    const searchIndex = useMemo(() => {
        if (!stops?.features) return [];

        return stops.features
            .filter(stop => stop.properties.location_type !== 2)
            .map(stop => {
                const normalizedName = normalizeString(stop.properties.stop_name);
                return {
                    stop,
                    normalizedName,
                    nameTokens: normalizedName.split(/[-\s/]+/)
                };
            });
    }, [stops]);

    // 2. Search logic (runs when query changes, but using pre-calculated index)
    const results = useMemo(() => {
        if (deferredQuery.length < 2) return [];

        const normalizedQuery = normalizeString(deferredQuery).trim();
        const queryTokens = normalizedQuery.split(/[-\s/]+/);

        const matches = searchIndex
            .filter(item => {
                // Every query token must match at least one name token (as prefix)
                return queryTokens.every(qToken =>
                    item.nameTokens.some(nToken => nToken.startsWith(qToken))
                );
            })
            .map(item => {
                let score = 0;

                // Exact match (highest priority)
                if (item.normalizedName === normalizedQuery) {
                    score += 1000;
                }
                // Starts with the full query string
                else if (item.normalizedName.startsWith(normalizedQuery)) {
                    score += 500;
                }
                // Sequential token prefix match
                else {
                    let matchesSequentially = true;
                    for (let i = 0; i < queryTokens.length; i++) {
                        if (!item.nameTokens[i] || !item.nameTokens[i].startsWith(queryTokens[i])) {
                            matchesSequentially = false;
                            break;
                        }
                    }
                    if (matchesSequentially) score += 250;
                }

                // First token match bonus
                if (item.nameTokens[0] && item.nameTokens[0].startsWith(queryTokens[0])) {
                    score += 100;
                }

                return { stop: item.stop, score };
            });

        // Sort by score and name
        matches.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.stop.properties.stop_name.localeCompare(b.stop.properties.stop_name);
        });

        // Deduplicate
        const seen = new Set<string>();
        const uniqueMatches: StopFeature[] = [];
        for (const match of matches) {
            if (!seen.has(match.stop.properties.stop_name)) {
                seen.add(match.stop.properties.stop_name);
                uniqueMatches.push(match.stop);
            }
            if (uniqueMatches.length >= 10) break;
        }

        return uniqueMatches;
    }, [searchIndex, deferredQuery]);

    return {
        query,
        setQuery,
        results
    };
};
