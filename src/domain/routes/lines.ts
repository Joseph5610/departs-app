import { FALLBACK_ROUTE_COLOR, LINE_SEARCH } from '@/config/constants';
import type { StopLine } from '@/types';

export type LineMetadata = { route_color: string; type: string };

/** A line as a badge draws it. */
export type LineBadgeData = { name: string; type: string; route_color?: string };

/**
 * The lines a search query names, or null when it isn't a line query. Comma-separated tokens form
 * one multi-line filter. A token counts when the city runs that line, or, until the city's lines
 * have loaded, when it has the generic line shape.
 */
export function parseLineQuery(query: string, knownLines: Map<string, LineMetadata>): string[] | null {
    const tokens = query.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    if (tokens.length === 0) return null;
    const isLine = knownLines.size > 0
        ? (name: string) => knownLines.has(name)
        : (name: string) => LINE_SEARCH.GENERIC_LINE_SHAPE.test(name);
    return tokens.every(isLine) ? tokens : null;
}

/**
 * Builds an O(1) lookup map for line metadata from a list of stops.
 */
const getLineMetadataMap = (stops: readonly { lines: readonly StopLine[] }[]): Map<string, LineMetadata> => {
    const map = new Map<string, LineMetadata>();
    for (const stop of stops) {
        for (const line of stop.lines) {
            const name = String(line.name).toUpperCase();
            if (!map.has(name)) {
                map.set(name, {
                    route_color: line.route_color || FALLBACK_ROUTE_COLOR,
                    type: line.type
                });
            }
        }
    }
    return map;
};

/**
 * Finds a line's metadata using an O(1) Map lookup.
 */
export const getLineMetadataFromMap = (name: string, metaMap: Map<string, LineMetadata>) => {
    if (!name) return null;
    return metaMap.get(name.toUpperCase()) || null;
};

/**
 * Returns the i18n translation key for a given route type slug.
 */
export const getRouteTypeI18nKey = (type: string | undefined | null): string => {
    return type ? `settings.vehicleTypes.${type}` : '';
};

/** Every line the city runs, from its stops and its routes file, for recognising a line query. */
export const knownLineMetadata = (stops: readonly { lines: readonly StopLine[] }[], routesByName: ReadonlyMap<string, LineMetadata>): Map<string, LineMetadata> => {
    const map = getLineMetadataMap(stops);
    for (const [name, route] of routesByName) {
        if (!map.has(name)) map.set(name, { route_color: route.route_color, type: route.type });
    }
    return map;
};

/** Badges for the named lines, coloured from the city's line metadata; a line it doesn't know shows as a bus. */
export const lineBadges = (names: readonly string[], metaMap: Map<string, LineMetadata>): LineBadgeData[] =>
    names.map(name => {
        const meta = getLineMetadataFromMap(name, metaMap);
        return { name, type: meta?.type || 'bus', route_color: meta?.route_color };
    });
