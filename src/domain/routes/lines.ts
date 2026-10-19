import { LINE_SEARCH } from '@/config/constants';
import type { RouteInfo } from '@/types';

/** What a line badge needs of a route: `routes.json` by upper-cased line name (`RouteMetadata.byName`). */
export type LineMetadata = Pick<RouteInfo, 'route_color' | 'type'>;

/** A line as a badge draws it. */
export type LineBadgeData = { name: string; type: string; route_color?: string };

/**
 * The lines a search query names, or null when it isn't a line query. Comma-separated tokens form
 * one multi-line filter. A token counts when the city runs that line, or, until the city's lines
 * have loaded, when it has the generic line shape.
 */
export function parseLineQuery(query: string, knownLines: ReadonlyMap<string, LineMetadata>): string[] | null {
    const tokens = query.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    if (tokens.length === 0) return null;
    const isLine = knownLines.size > 0
        ? (name: string) => knownLines.has(name)
        : (name: string) => LINE_SEARCH.GENERIC_LINE_SHAPE.test(name);
    return tokens.every(isLine) ? tokens : null;
}

/**
 * Returns the i18n translation key for a given route type slug.
 */
export const getRouteTypeI18nKey = (type: string | undefined | null): string => {
    return type ? `settings.vehicleTypes.${type}` : '';
};

/** Badges for the named lines, coloured from the city's line metadata; a line it doesn't know shows as a bus. */
export const lineBadges = (names: readonly string[], metaMap: ReadonlyMap<string, LineMetadata>): LineBadgeData[] =>
    names.map(name => {
        const meta = metaMap.get(name.toUpperCase());
        return { name, type: meta?.type || 'bus', route_color: meta?.route_color };
    });
