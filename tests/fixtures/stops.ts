import type { Page } from '@playwright/test';

/** A stop as the specs describe it: the old map-stops.json feature shape. */
interface StopFixture {
    geometry: { coordinates: number[] };
    properties: {
        stop_id: string;
        stop_name: string;
        platform_code?: string | null;
        location_type?: number;
        parent_station?: string | null;
        zone_id?: string | null;
        is_centroid?: boolean;
        lines?: Array<{ name: string; type: string; route_color: string }>;
    };
}

interface Route { name: string; type: string; route_color: string }

export const STOPS_FILE_URL = /\/[^/]+\/stops\.json(\?|$)/;
const ROUTES_FILE_URL = /\/[^/]+\/routes\.json(\?|$)/;

const posOf = (f: StopFixture): [number, number] => [f.geometry.coordinates[0]!, f.geometry.coordinates[1]!];

/** The `stops.json` and `routes.json` a city would publish for these stops; a platform without a parent gets a station of its own. */
export function stopFilesOf({ features }: { features: StopFixture[] }) {
    const routes: Record<string, Route> = {};
    const stations = new Map<string, { id: string; name: string; pos: [number, number] }>();
    for (const f of features) {
        if (f.properties.is_centroid || f.properties.location_type === 1) {
            stations.set(f.properties.stop_id, { id: f.properties.stop_id, name: f.properties.stop_name, pos: posOf(f) });
        }
    }
    const platforms = features
        .filter(f => !f.properties.is_centroid && (f.properties.location_type ?? 0) === 0)
        .map(f => {
            const p = f.properties;
            const [id, ...aliases] = p.stop_id.split(',');
            const station = p.parent_station ?? `station-${id}`;
            if (!stations.has(station)) stations.set(station, { id: station, name: p.stop_name, pos: posOf(f) });
            const routeIds = (p.lines ?? []).map(line => {
                const routeId = `${line.type}-${line.name}`;
                routes[routeId] = line;
                return routeId;
            });
            return {
                id: id!,
                aliases: aliases.length ? aliases : undefined,
                station,
                pos: posOf(f),
                code: p.platform_code ?? undefined,
                zones: p.zone_id ? [p.zone_id] : undefined,
                routes: routeIds,
            };
        });
    const entrances = features
        .filter(f => f.properties.location_type === 2 && f.properties.parent_station)
        .map(f => ({ id: f.properties.stop_id, station: f.properties.parent_station!, name: f.properties.stop_name, pos: posOf(f) }));
    return { stopsFile: { version: 1, stations: [...stations.values()], platforms, entrances }, routes };
}

/** Serves these stops as the city's `stops.json`, with the `routes.json` their lines need. */
export async function mockStops(page: Page, collection: { features: StopFixture[] }): Promise<void> {
    const { stopsFile, routes } = stopFilesOf(collection);
    const json = (body: unknown) => ({ headers: { 'Access-Control-Allow-Origin': '*' }, status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    await page.route(STOPS_FILE_URL, route => route.fulfill(json(stopsFile)));
    await page.route(ROUTES_FILE_URL, route => route.fulfill(json(routes)));
}
