/** Whether every query token starts some token of the searched text. */
export const matchesAllTokens = (queryTokens: string[], tokens: string[]): boolean =>
    queryTokens.every((queryToken) => tokens.some((token) => token.startsWith(queryToken)));

/** The first `limit` items with distinct keys, in order. */
export const firstUnique = <T,>(items: Iterable<T>, keyOf: (item: T) => string, limit: number): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
        const key = keyOf(item);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
        if (result.length >= limit) break;
    }
    return result;
};
