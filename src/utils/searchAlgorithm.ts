import { normalizeString } from './stringUtils';
import type { StopFeature } from '../types/transit';

export interface SearchIndexItem {
    stop: StopFeature;
    normalizedName: string;
    nameTokens: string[];
    stopId: string;
}

export const createSearchIndex = (features: StopFeature[]): SearchIndexItem[] => {
    return features
        .filter((stop) => stop.properties.location_type !== 2)
        .map((stop) => {
            const normalizedName = normalizeString(stop.properties.stop_name);
            const stopId = stop.properties.stop_id.toUpperCase();
            return {
                stop,
                normalizedName,
                nameTokens: normalizedName.split(/[-\s/]+/),
                stopId
            };
        });
};

export const searchStops = (searchIndex: SearchIndexItem[], query: string): StopFeature[] => {
    if (query.length < 2) return [];

    const normalizedQuery = normalizeString(query).trim();
    const upperQuery = query.trim().toUpperCase();
    const queryTokens = normalizedQuery.split(/[-\s/]+/);

    const matches = searchIndex
        .filter((item) => {
            // Match by stop ID prefix
            if (item.stopId.startsWith(upperQuery)) return true;

            // Every query token must match at least one name token (as prefix)
            return queryTokens.every((qToken) => {
                return item.nameTokens.some((nToken) => nToken.startsWith(qToken));
            });
        })
        .map(item => {
            let score = 0;

            // Stop ID match (highest priority)
            if (item.stopId === upperQuery) {
                score += 2000;
            } else if (item.stopId.startsWith(upperQuery)) {
                score += 1500;
            }

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
        if (b.score !== a.score) {
            return b.score - a.score;
        }
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
        if (uniqueMatches.length >= 10) {
            break;
        }
    }

    return uniqueMatches;
};
