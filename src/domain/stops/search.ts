import { normalizeString } from '@/lib/strings';
import { firstUnique, matchesAllTokens } from '@/lib/search';
import type { StopFeature } from '@/types';
import { STOP_SEARCH } from '@/config/constants';

export interface SearchIndexItem {
    stop: StopFeature;
    normalizedName: string;
    nameTokens: string[];
    stopId: string;
}

/** Searchable platforms and stations; entrances (location_type 2) and centroids are left out. */
export const createSearchIndex = (features: StopFeature[]): SearchIndexItem[] =>
    features
        .filter((stop) => stop.properties.location_type !== 2 && !stop.properties.is_centroid)
        .map((stop) => {
            const normalizedName = normalizeString(stop.properties.stop_name);
            return {
                stop,
                normalizedName,
                nameTokens: normalizedName.split(STOP_SEARCH.TOKEN_SEPARATORS),
                stopId: stop.properties.stop_id.toUpperCase(),
            };
        });

const scoreOf = (item: SearchIndexItem, upperQuery: string, normalizedQuery: string, queryTokens: string[]): number => {
    const { SCORES } = STOP_SEARCH;
    let score = 0;
    if (item.stopId === upperQuery) score += SCORES.STOP_ID_EXACT;
    else if (item.stopId.startsWith(upperQuery)) score += SCORES.STOP_ID_PREFIX;

    if (item.normalizedName === normalizedQuery) score += SCORES.NAME_EXACT;
    else if (item.normalizedName.startsWith(normalizedQuery)) score += SCORES.NAME_PREFIX;
    else if (queryTokens.every((token, i) => item.nameTokens[i]?.startsWith(token))) score += SCORES.TOKENS_IN_ORDER;

    if (item.nameTokens[0] && item.nameTokens[0].startsWith(queryTokens[0])) score += SCORES.FIRST_TOKEN;
    return score;
};

/** Stops by id prefix or by every query word starting a word of the name, best first, one per name. */
export const searchStops = (searchIndex: SearchIndexItem[], query: string): StopFeature[] => {
    if (query.length < STOP_SEARCH.MIN_QUERY_LENGTH) return [];

    const normalizedQuery = normalizeString(query).trim();
    const upperQuery = query.trim().toUpperCase();
    const queryTokens = normalizedQuery.split(STOP_SEARCH.TOKEN_SEPARATORS).filter(Boolean);

    const matches = searchIndex
        .filter((item) => item.stopId.startsWith(upperQuery) || matchesAllTokens(queryTokens, item.nameTokens))
        .map((item) => ({ stop: item.stop, score: scoreOf(item, upperQuery, normalizedQuery, queryTokens) }))
        .sort((a, b) => b.score - a.score || a.stop.properties.stop_name.localeCompare(b.stop.properties.stop_name));

    return firstUnique(matches, (match) => match.stop.properties.stop_name, STOP_SEARCH.RESULT_LIMIT).map((match) => match.stop);
};
