
import { useState, useMemo } from 'react';
import { normalizeString } from '../utils/stringUtils';

// Define the Stop interface internally or import it if shared
export interface Stop {
    type: 'Feature';
    properties: {
        stop_id: string;
        stop_name: string;
        platform_code?: string;
        location_type?: number;
    };
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
}

export const useStopSearch = (stops: { features: Stop[] } | null) => {
    const [query, setQuery] = useState('');

    const results = useMemo(() => {
        if (!stops?.features || query.length < 2) return [];

        const normalizedQuery = normalizeString(query).trim();
        const queryTokens = normalizedQuery.split(/[-\s/]+/);

        // 1. Filter and score matches
        const matches = (stops.features as Stop[])
            .filter(stop => stop.properties.location_type !== 2)
            .map(stop => {
                const normalizedName = normalizeString(stop.properties.stop_name);
                return {
                    stop,
                    normalizedName,
                    nameTokens: normalizedName.split(/[-\s/]+/)
                };
            })
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
                // Starts with the full query string (e.g., "sidliste c" matches "sidliste cakovice")
                else if (item.normalizedName.startsWith(normalizedQuery)) {
                    score += 500;
                }
                // Sequential token prefix match (e.g., "sidl cak" matches "sidliste cakovice")
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

        // 2. Sort by score and name
        matches.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.stop.properties.stop_name.localeCompare(b.stop.properties.stop_name);
        });

        // 3. Deduplicate by name (keeping the first occurrence)
        const seen = new Set<string>();
        const uniqueMatches: Stop[] = [];
        for (const match of matches) {
            if (!seen.has(match.stop.properties.stop_name)) {
                seen.add(match.stop.properties.stop_name);
                uniqueMatches.push(match.stop);
            }
            if (uniqueMatches.length >= 10) break;
        }

        return uniqueMatches;
    }, [query, stops]);

    return {
        query,
        setQuery,
        results
    };
};
