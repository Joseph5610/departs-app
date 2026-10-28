/** How an alert's line is matched to a route, as both the app and the server's MCP tools resolve it. Plain TypeScript without imports. */

const KORDIS_NUMERIC_ID = /^L([A-Z0-9]+)D/i;

/** The numeric segment KORDIS alerts use for a routes.json id (`L120D99` -> `120`), upper-cased; null for other ids. */
export const kordisNumericId = (routeId: string): string | null => KORDIS_NUMERIC_ID.exec(routeId)?.[1].toUpperCase() ?? null;

/** A route table keyed one way: a `Map` or anything that answers `get`. */
export interface LineLookup<R> {
    get(key: string): R | undefined;
}

/**
 * The route an alert line names: by routes.json id, else by upper-cased name, else by KORDIS numeric id.
 * Names before numeric ids: night line `L99D99` displays as `N99`.
 */
export const resolveLine = <R>(line: string, byId: LineLookup<R>, byName: LineLookup<R>, byKordisNumeric: LineLookup<R>): R | undefined => {
    const upper = line.toUpperCase();
    return byId.get(line) ?? byName.get(upper) ?? byKordisNumeric.get(upper);
};
