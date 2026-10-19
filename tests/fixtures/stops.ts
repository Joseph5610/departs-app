import type { Page } from '@playwright/test';

type Pos = [number, number];

interface Route { name: string; type: string; route_color: string }
interface Station { id: string; name: string; pos: Pos }
interface Platform { id: string; aliases?: string[]; station: string; pos: Pos; code?: string; zones?: string[]; routes: string[] }
interface Entrance { id: string; station: string; name: string; pos: Pos }

/** A city's `stops.json`, and the `routes.json` entries its platforms name. */
export interface StopsFixture {
    stations: Station[];
    platforms: Platform[];
    entrances?: Entrance[];
    routes?: Record<string, Route>;
}

export const STOPS_FILE_URL = /\/[^/]+\/stops\.json(\?|$)/;
const ROUTES_FILE_URL = /\/[^/]+\/routes\.json(\?|$)/;

export const METRO_C: Record<string, Route> = { L993: { name: 'C', type: 'metro', route_color: 'C0115E' } };

/** Hlavní nádraží with its one platform `U1111Z1P` (C), served by metro C unless `routes` says otherwise. */
export const hlavniNadrazi = (routes: Record<string, Route> = METRO_C): StopsFixture => ({
    stations: [{ id: 'U1111', name: 'Hlavní nádraží', pos: [14.4332, 50.0831] }],
    platforms: [{ id: 'U1111Z1P', station: 'U1111', pos: [14.4332, 50.0831], code: 'C', zones: ['P'], routes: Object.keys(routes) }],
    routes,
});

/** Stations of one platform each, named `station-<platform id>`. */
export const singlePlatformStations = (stops: Array<{ id: string; name: string; pos: Pos; routes?: string[] }>): Pick<StopsFixture, 'stations' | 'platforms'> => ({
    stations: stops.map(({ id, name, pos }) => ({ id: `station-${id}`, name, pos })),
    platforms: stops.map(({ id, pos, routes = [] }) => ({ id, station: `station-${id}`, pos, zones: ['P'], routes })),
});

/** Serves `stops` as the city's `stops.json`, with its `routes.json`. */
export async function mockStops(page: Page, { stations, platforms, entrances = [], routes = {} }: StopsFixture): Promise<void> {
    const json = (body: unknown) => ({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    await page.route(STOPS_FILE_URL, route => route.fulfill(json({ version: 1, stations, platforms, entrances })));
    await page.route(ROUTES_FILE_URL, route => route.fulfill(json(routes)));
}
