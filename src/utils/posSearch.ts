import { normalizeString } from './stringUtils';
import { calculateDistance } from './transitUtils';
import { POS_SEARCH } from '../config/constants';
import type { PointOfSale, PointOfSaleType } from '../types/pointsOfSale';

export interface PosSearchIndexItem {
    pos: PointOfSale;
    nameTokens: string[];
    normalizedName: string;
    addressTokens: string[];
    /** Type label and intent words, so "ticket" or "jízdenka" finds a machine nobody knows by name. */
    intentTokens: string[];
}

export interface PosSearchResult {
    pos: PointOfSale;
    distance: number | null;
}

const tokenize = (value: string): string[] =>
    normalizeString(value).split(POS_SEARCH.TOKEN_SEPARATORS).filter(Boolean);

/** `typeLabels` carries the translated `pos.types.*` strings, so the active locale is searchable too. */
export const createPosSearchIndex = (
    posList: PointOfSale[],
    typeLabels: Record<PointOfSaleType, string>
): PosSearchIndexItem[] =>
    posList.map((pos) => {
        const normalizedName = normalizeString(pos.name);
        const intentWords = [
            typeLabels[pos.type] ?? '',
            ...POS_SEARCH.INTENT_KEYWORDS,
            ...(POS_SEARCH.TYPE_KEYWORDS[pos.type] ?? []),
        ];
        return {
            pos,
            normalizedName,
            nameTokens: normalizedName.split(POS_SEARCH.TOKEN_SEPARATORS).filter(Boolean),
            addressTokens: tokenize(pos.address),
            intentTokens: [...new Set(intentWords.flatMap(tokenize))],
        };
    });

const matchesAll = (queryTokens: string[], tokens: string[]): boolean =>
    queryTokens.every((queryToken) => tokens.some((token) => token.startsWith(queryToken)));

export const searchPointsOfSale = (
    index: PosSearchIndexItem[],
    query: string,
    origin: [number, number] | null
): PosSearchResult[] => {
    const normalizedQuery = normalizeString(query).trim();
    if (normalizedQuery.length < POS_SEARCH.MIN_QUERY_LENGTH) return [];

    const queryTokens = normalizedQuery.split(POS_SEARCH.TOKEN_SEPARATORS).filter(Boolean);
    if (queryTokens.length === 0) return [];

    const matches: Array<PosSearchResult & { score: number }> = [];
    for (const item of index) {
        let score = 0;
        if (item.normalizedName === normalizedQuery) {
            score = POS_SEARCH.SCORES.NAME_EXACT;
        } else if (item.normalizedName.startsWith(normalizedQuery)) {
            score = POS_SEARCH.SCORES.NAME_PREFIX;
        } else if (matchesAll(queryTokens, item.nameTokens)) {
            score = POS_SEARCH.SCORES.NAME_TOKENS;
        } else if (matchesAll(queryTokens, item.addressTokens)) {
            score = POS_SEARCH.SCORES.ADDRESS;
        } else if (matchesAll(queryTokens, item.intentTokens)) {
            score = POS_SEARCH.SCORES.INTENT;
        }
        if (score === 0) continue;

        matches.push({
            pos: item.pos,
            score,
            distance: origin ? calculateDistance(origin, [item.pos.lon, item.pos.lat]) : null,
        });
    }

    matches.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
        return a.pos.name.localeCompare(b.pos.name);
    });

    // A city has many identically named machines; one row per name and type keeps the short group varied.
    const seen = new Set<string>();
    const results: PosSearchResult[] = [];
    for (const { pos, distance } of matches) {
        const key = `${normalizeString(pos.name)}|${pos.type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ pos, distance });
        if (results.length >= POS_SEARCH.RESULT_LIMIT) break;
    }
    return results;
};
