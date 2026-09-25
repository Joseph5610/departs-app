import { LINE_SEARCH } from '../config/constants';

export type LineMetadata = { route_color: string; type: string };

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
