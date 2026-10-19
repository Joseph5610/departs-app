import { normalizeString } from '@/lib/strings';
import { firstUnique, matchesAllTokens } from '@/lib/search';
import type { Stop } from '@/types';
import { STOP_SEARCH } from '@/config/constants';

export interface SearchIndexItem {
    stop: Stop;
    normalizedName: string;
    nameTokens: string[];
    stopId: string;
}

/** Searchable stations and platforms. */
export const createSearchIndex = (stops: readonly Stop[]): SearchIndexItem[] =>
    stops.map((stop) => {
        const normalizedName = normalizeString(stop.name);
        return {
            stop,
            normalizedName,
            nameTokens: normalizedName.split(STOP_SEARCH.TOKEN_SEPARATORS),
            stopId: stop.id.toUpperCase(),
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

const isStation = (stop: Stop) => Number(stop.kind === 'station');

/** Stops by id prefix or by every query word starting a word of the name, best first, one per name: a station before its platforms. */
export const searchStops = (searchIndex: SearchIndexItem[], query: string): Stop[] => {
    if (query.length < STOP_SEARCH.MIN_QUERY_LENGTH) return [];

    const normalizedQuery = normalizeString(query).trim();
    const upperQuery = query.trim().toUpperCase();
    const queryTokens = normalizedQuery.split(STOP_SEARCH.TOKEN_SEPARATORS).filter(Boolean);

    const matches = searchIndex
        .filter((item) => item.stopId.startsWith(upperQuery) || matchesAllTokens(queryTokens, item.nameTokens))
        .map((item) => ({ stop: item.stop, score: scoreOf(item, upperQuery, normalizedQuery, queryTokens) }))
        .sort((a, b) => b.score - a.score
            || isStation(b.stop) - isStation(a.stop)
            || a.stop.name.localeCompare(b.stop.name));

    return firstUnique(matches, (match) => match.stop.name, STOP_SEARCH.RESULT_LIMIT).map((match) => match.stop);
};
