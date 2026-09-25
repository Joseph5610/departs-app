import type { RouteType } from '../types/vehicles';

/**
 * Normalizes a GTFS route_type (numeric GTFS 0-12, extended 100-999, or string) to a vehicle type
 * slug. Mirrors `functions/_core/utils/routeTypes.ts` - the backend still does this normalization
 * itself for its own use (metro grouping, MCP output); this copy exists so the frontend can key its
 * `<city>/routes.json` join the same way the vehicles/departures it's joining against already are.
 * Keep both copies in sync if the GTFS type mapping ever changes.
 */
export const normalizeRouteType = (type: number | string | undefined | null): RouteType => {
    if (type === undefined || type === null) return 'unknown';
    const strType = String(type).toLowerCase();

    if (['tram', 'metro', 'train', 'bus', 'ferry', 'funicular', 'trolleybus'].includes(strType)) {
        return strType as RouteType;
    }

    const n = Number(type);
    if (Number.isNaN(n)) return (strType || 'unknown') as RouteType;

    if (n >= 100 && n <= 199) return 'train';
    if (n >= 700 && n <= 799) return 'bus';
    if (n >= 800 && n <= 899) return 'trolleybus';
    if (n >= 900 && n <= 999) return 'tram';

    switch (n) {
        case 0: return 'tram';
        case 1: return 'metro';
        case 2: return 'train';
        case 3: return 'bus';
        case 4: return 'ferry';
        case 7: return 'funicular';
        case 11: return 'trolleybus';
        default: return 'unknown';
    }
};

/**
 * The key the frontend's route-metadata join uses: a line number alone can collide across modes
 * (e.g. DÚK's trolleybus 70 and bus 70 are different routes with different colors), so both sides of
 * the join normalize type first and key on `type|name` rather than name alone.
 */
export const routeJoinKey = (type: string | number | undefined | null, name: string): string =>
    `${normalizeRouteType(type)}|${name.toUpperCase()}`;
