/**
 * Golemio answers at most `DEPARTURE_LIMIT` departures per stop group, so a station asked for as one group
 * shows only its next few minutes. Each platform id becomes its own group instead, up to `maxGroups` in one
 * request; past that, each requested stop stays one group, so a large favourites request keeps a sane URL.
 * `requestOf[i]` is the requested stop group `i` answers.
 */
export function stopGroups(requests: readonly string[][], maxGroups: number): { groups: string[][]; requestOf: number[] } {
    const total = requests.reduce((n, ids) => n + ids.length, 0);
    if (total > maxGroups) return { groups: requests.map(ids => [...ids]), requestOf: requests.map((_, i) => i) };
    const groups: string[][] = [];
    const requestOf: number[] = [];
    requests.forEach((ids, i) => {
        for (const id of ids) {
            groups.push([id]);
            requestOf.push(i);
        }
    });
    return { groups, requestOf };
}

/** The groups' departures gathered back per requested stop, in request order. */
export function byRequest<T>(boards: readonly T[][], requestOf: readonly number[], requestCount: number): T[][] {
    const merged: T[][] = Array.from({ length: requestCount }, () => []);
    boards.forEach((board, i) => {
        const request = requestOf[i];
        if (request !== undefined) merged[request]!.push(...board);
    });
    return merged;
}
