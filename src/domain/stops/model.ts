import type { BoardStop, Entrance, Platform, RouteInfo, SelectedStop, Station, Stop, StopLine, StopModel, StopsFile, StopsFilePlatform } from '@/types';
import { normalizeRouteType } from '@/domain/routes';
import { getOrCreate } from '@/lib/memoize';

/** Lines without repeats of the same mode and name, as a station lists its platforms' lines. */
export const uniqueLines = <L extends { type: string; name: string }>(lines: readonly L[]): L[] =>
    [...new Map(lines.map(line => [`${line.type}|${line.name}`, line])).values()];

/** The ids a stop id names: a single stop, or a comma-joined list (a board section, a pre-stops.json PID link). */
export const stopIdParts = (id: string): string[] => id.split(',').map(part => part.trim()).filter(Boolean);

/** A platform's ids: its own first, then its aliases. */
export const platformIds = (p: Pick<Platform, 'id' | 'aliases'>): string[] => p.aliases ? [p.id, ...p.aliases] : [p.id];

/**
 * A city's `stops.json` as stations holding their platforms, every platform named after its station. Each
 * id and alias resolves in `byId`; a platform's own entry wins over a station that happens to share it.
 */
export const buildStopModel = (file: StopsFile, routes: Readonly<Record<string, RouteInfo>>): StopModel => {
    const linesOf = (ids: readonly string[]): StopLine[] => ids.flatMap(id => {
        const route = routes[id];
        return route ? [{ name: route.name, type: normalizeRouteType(route.type), route_color: route.route_color }] : [];
    });
    const nameOf = new Map(file.stations.map(s => [s.id, s.name]));

    const platformsOf = new Map<string, Platform[]>();
    const platforms = file.platforms.map((p: StopsFilePlatform): Platform => {
        const platform: Platform = {
            kind: 'platform',
            id: p.id,
            aliases: p.aliases,
            station: p.station,
            name: nameOf.get(p.station) ?? '',
            pos: p.pos,
            code: p.code,
            direction: p.direction,
            lines: linesOf(p.routes),
            alightOnly: p.alightOnly,
            interchanges: p.interchanges,
        };
        getOrCreate(platformsOf, p.station, (): Platform[] => []).push(platform);
        return platform;
    });

    const stations = file.stations.map((s): Station => {
        const own = platformsOf.get(s.id) ?? [];
        return {
            kind: 'station',
            id: s.id,
            name: s.name,
            pos: s.pos,
            platforms: own,
            lines: uniqueLines(own.flatMap(p => p.lines)),
            // Nobody boards at a station whose every platform is alight-only: the map leaves it out with them.
            alightOnly: own.every(p => p.alightOnly) ? true : undefined,
        };
    });

    const entrances = file.entrances.map((e): Entrance => ({ kind: 'entrance', id: e.id, station: e.station, name: e.name, pos: e.pos }));

    const byId = new Map<string, Stop>();
    for (const s of stations) byId.set(s.id, s);
    for (const p of platforms) for (const id of platformIds(p)) byId.set(id, p);
    return { stations, platforms, entrances, byId };
};

const stationBoard = (s: Station): BoardStop => ({ kind: 'station', id: s.id, name: s.name, pos: s.pos, lines: s.lines, platforms: s.platforms, stop: s });
const platformBoard = (p: Platform): BoardStop => ({ kind: 'platform', id: p.id, name: p.name, pos: p.pos, lines: p.lines, platforms: [p], code: p.code, stop: p });

/** The board for a stop. */
export const boardOf = (stop: Stop): BoardStop => stop.kind === 'station' ? stationBoard(stop) : platformBoard(stop);

/**
 * The board `id` names: a station or platform by its id or an alias, or a comma-joined list of platforms.
 * A list naming one platform (a merged PID platform) or exactly a station's platforms (a pre-stops.json PID
 * station) is that stop; any other is a section of those platforms, named by their ids in the list's order.
 * Null when the model knows none of it.
 */
export const resolveStop = (model: StopModel, id: string): BoardStop | null => {
    const own = model.byId.get(id);
    if (own) return boardOf(own);

    const platforms = [...new Set(stopIdParts(id).flatMap(part => {
        const stop = model.byId.get(part);
        return !stop ? [] : stop.kind === 'platform' ? [stop] : stop.platforms;
    }))];
    const first = platforms[0];
    if (!first) return null;
    if (platforms.length === 1) return platformBoard(first);

    const station = model.byId.get(first.station);
    if (station?.kind === 'station' && station.platforms.length === platforms.length && platforms.every(p => p.station === station.id)) {
        return stationBoard(station);
    }
    const code = platforms.every(p => p.code === first.code) ? first.code : undefined;
    return {
        kind: 'section',
        id: platforms.map(p => p.id).join(','),
        name: first.name,
        pos: first.pos,
        lines: uniqueLines(platforms.flatMap(p => p.lines)),
        platforms,
        code,
    };
};

/**
 * The `stopId` a departures request names a board by. A network whose departures API knows no stations
 * (`byPlatforms`, Golemio) is asked for every platform and alias; any other takes the board's own id.
 */
export const departuresRequestId = (board: BoardStop, byPlatforms: boolean): string =>
    byPlatforms ? board.platforms.flatMap(platformIds).join(',') || board.id : board.id;

/** Every id departures and notices may name a board's stops by: its own, its station's, its platforms' and their aliases. */
export const boardStopIds = (board: BoardStop): string[] =>
    [...new Set([board.id, ...board.platforms.flatMap(platformIds)])];

/** Each id a board's platforms go by, mapped to the platform's code. */
export const platformCodes = (platforms: readonly Platform[]): Map<string, string> => {
    const codes = new Map<string, string>();
    for (const p of platforms) if (p.code) for (const id of platformIds(p)) codes.set(id, p.code);
    return codes;
};

/** Whether a board gathers several platforms, so its rows name the platform each leaves from. */
export const isStationBoard = (board: Pick<BoardStop, 'kind' | 'platforms'>): boolean =>
    board.kind === 'station' && board.platforms.length > 1;

/**
 * The stop a URL id opens and the id its departures are requested by. Until the stop list loads, any other
 * network is asked for the URL id as it stands; a `byPlatforms` one waits, since it must name every platform.
 */
export const selectStop = (id: string, model: StopModel | null, byPlatforms: boolean): SelectedStop => {
    const board = model ? resolveStop(model, id) : null;
    const departuresId = board ? departuresRequestId(board, byPlatforms) : model || !byPlatforms ? id : null;
    return { id, board, departuresId };
};
