const enc = encodeURIComponent;

/** Route patterns matched by `useRouteParams`; `paths` builds URLs of the same shapes. */
export const ROUTE_PATTERNS = {
    tripVehicle: '/:city/trip/:tripId/:vehicleId',
    trip: '/:city/trip/:tripId',
    stop: '/:city/stop/:stopId',
    pos: '/:city/pos/:posId',
    stats: '/:city/stats',
    favorites: '/:city/favorites',
    city: '/:city',
} as const;

export const paths = {
    city: (city: string) => `/${city}`,
    stop: (city: string, stopId: string) => `/${city}/stop/${enc(stopId)}`,
    pos: (city: string, posId: string) => `/${city}/pos/${enc(posId)}`,
    trip: (city: string, tripId: string, vehicleId?: string | null) =>
        vehicleId && vehicleId !== tripId
            ? `/${city}/trip/${enc(tripId)}/${enc(vehicleId)}`
            : `/${city}/trip/${enc(tripId)}`,
    stats: (city: string) => `/${city}/stats`,
    favorites: (city: string) => `/${city}/favorites`,
};

type RouteParams = Partial<Record<'city' | 'stopId' | 'posId' | 'tripId' | 'vehicleId', string>>;

/** ROUTE_PATTERNS compiled like wouter does: case-insensitive, one segment per param, optional trailing slash. */
const COMPILED_ROUTES = Object.values(ROUTE_PATTERNS).map((pattern) => {
    const keys: string[] = [];
    const source = pattern.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
        keys.push(key);
        return '([^/]+?)';
    });
    return { regex: new RegExp(`^${source}/?$`, 'i'), keys };
});

/**
 * Params of the first route matching `pathname`, in ROUTE_PATTERNS order. For code outside React,
 * such as crash reports, which must not depend on the router still working.
 */
export function matchRoutePath(pathname: string): RouteParams {
    for (const { regex, keys } of COMPILED_ROUTES) {
        const match = regex.exec(pathname);
        if (!match) continue;
        const params: RouteParams = {};
        keys.forEach((key, i) => { params[key as keyof RouteParams] = decodeRouteParam(match[i + 1]); });
        return params;
    }
    return {};
}

/**
 * Decodes a route param. wouter has already applied `decodeURI`, which leaves reserved characters
 * such as `%2F` encoded, so a second pass is needed; it must not throw when the ID contains a bare `%`.
 */
export function decodeRouteParam(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}
