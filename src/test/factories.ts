import type { Departure, DepartureFeeder, RouteInfo, StopModel, StopsFile, StopsFilePlatform, StoredEnrichmentPatch, VehicleDetail, VehicleFeature, StopTimeFeature } from '@/types';
import { buildStopModel } from '@/domain/stops';

/** Fixed "now" for unit tests: 2026-10-07 12:00 UTC, 14:00 in Prague. */
export const NOW = Date.parse('2026-10-07T12:00:00Z');
export const MIN = 60_000;

/** ISO timestamp `offsetMs` from NOW. */
export const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

export const departure = (overrides: Partial<Departure> = {}): Departure => ({
    timestamp: at(5 * MIN),
    scheduled: at(5 * MIN),
    delay: 0,
    line: '22',
    type: 'tram',
    directionId: '0',
    headsign: 'Bílá Hora',
    isCanceled: false,
    tripId: 'trip-1',
    ...overrides,
});

/** A live-stream vehicle running `tripId`, with id `veh-<tripId>`. */
export const vehicle = (tripId: string, overrides: Partial<VehicleFeature['properties']> = {}, coordinates: [number, number] = [14.42, 50.08]): VehicleFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: {
        vehicle_id: `veh-${tripId}`,
        gtfs_trip_id: tripId,
        route_short_name: '22',
        route_type: 'tram',
        bearing: null,
        delay: 0,
        state_position: 'on_track',
        route_color: '000000',
        ...overrides,
    },
});

export const vehicleDetail = (overrides: Partial<VehicleDetail> = {}): VehicleDetail => ({
    vehicle_id: 'veh-trip-1',
    gtfs_trip_id: 'trip-1',
    route_short_name: '22',
    route_type: 'tram',
    trip_headsign: 'Bílá Hora',
    bearing: null,
    delay: null,
    route_color: '7A0603',
    ...overrides,
});

export const feeder = (overrides: Partial<DepartureFeeder> = {}): DepartureFeeder => ({
    line: '9',
    type: 'tram',
    trip_id: 'feeder-1',
    base_hold_s: 60,
    max_wait_s: 180,
    hold_s: null,
    will_miss: false,
    ...overrides,
});

/** A push patch received at NOW. */
export const patch = (overrides: Partial<StoredEnrichmentPatch>): StoredEnrichmentPatch => ({
    dataTimestamp: NOW,
    receivedAt: NOW,
    ...overrides,
});

/** Index of features by key, as the hooks build them from the live stream. */
export const indexBy = <T,>(items: T[], key: (item: T) => string | null) =>
    new Map(items.flatMap((item) => {
        const k = key(item);
        return k ? [[k, item] as const] : [];
    }));

/** A trip stop at `sequence`, arriving and departing at `time` (`HH:MM:SS`, Prague timetable time). */
export const stopTime = (sequence: number, time: string, overrides: Partial<StopTimeFeature['properties']> = {}): StopTimeFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [14.42, 50.08 + sequence / 1000] },
    properties: {
        stop_id: `stop-${sequence}`,
        stop_name: `Stop ${sequence}`,
        stop_sequence: sequence,
        arrival_time: time,
        departure_time: time,
        ...overrides,
    },
});

/** Routes the stop builders name: trams 9 and 17, metro A and B, bus 67. */
export const ROUTES: Record<string, RouteInfo> = {
    T9: { name: '9', type: 'tram', route_color: '#7A0603' },
    T17: { name: '17', type: 'tram', route_color: '#7A0603' },
    MA: { name: 'A', type: 'metro', route_color: '#00A562' },
    MB: { name: 'B', type: 'metro', route_color: '#F8B322' },
    B67: { name: '67', type: 'bus', route_color: '#007DA8' },
};

const STOP_POS: [number, number] = [14.42, 50.08];

type PlatformSpec = Omit<StopsFilePlatform, 'station' | 'pos' | 'routes'> & { pos?: [number, number]; routes?: string[] };
type StationSpec = { id: string; name?: string; pos?: [number, number]; platforms: PlatformSpec[] };

/** A `stops.json` of these stations, each platform at its station's position unless given its own; names default to the id. */
export const stopsFile = (stations: StationSpec[], entrances: StopsFile['entrances'] = []): StopsFile => ({
    version: 1,
    stations: stations.map(s => ({ id: s.id, name: s.name ?? s.id, pos: s.pos ?? STOP_POS })),
    platforms: stations.flatMap(s => s.platforms.map(({ pos, routes, ...p }) => ({ ...p, station: s.id, pos: pos ?? s.pos ?? STOP_POS, routes: routes ?? [] }))),
    entrances,
});

/** The stop model of `stopsFile(stations)` over ROUTES. */
export const stopModel = (stations: StationSpec[], entrances: StopsFile['entrances'] = []): StopModel =>
    buildStopModel(stopsFile(stations, entrances), ROUTES);
