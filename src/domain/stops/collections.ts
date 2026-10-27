import type { BoardStop, Entrance, FavoriteStop, PinnedStop, Platform, SearchHistoryBase, SearchHistoryItem, ShownHistoryItem, Station, Stop, StopLine, StopModel } from '@/types';
import { mapStable } from '@/lib/memoize';
import { servesMode } from './stations';
import { resolveStop } from './model';
import { indexStops, withoutTwins } from './twins';
import { SHARED_GROUND } from '@/config/constants';

/** Whether a stop passes the map's stop-type filter; an empty filter passes every stop. */
const matchesStopTypeFilter = (stop: { lines: readonly StopLine[] }, stopTypeFilter: readonly string[]): boolean => {
    if (stopTypeFilter.length === 0) return true;
    return (stopTypeFilter.includes('metro') && servesMode(stop, 'metro')) || (stopTypeFilter.includes('train') && servesMode(stop, 'train'));
};

/** The stops the map draws: alight-only ones are left out, and with a stop-type filter so are entrances and stops of other modes. */
export const mapStopsOf = (model: StopModel | null | undefined, stopTypeFilter: readonly string[]): { stations: Station[]; platforms: Array<Platform | Entrance> } => {
    if (!model) return { stations: [], platforms: [] };
    const shown = <S extends Stop>(stop: S) => !stop.alightOnly && matchesStopTypeFilter(stop, stopTypeFilter);
    return {
        stations: model.stations.filter(shown),
        platforms: stopTypeFilter.length ? model.platforms.filter(shown) : [...model.platforms.filter(shown), ...model.entrances],
    };
};

/**
 * The stops the map draws: the selected network's, then each other network's where the selected one has none
 * on the same spot (a platform within a few metres, a station of the same name nearby).
 */
export const mapStopsWithOverlay = (model: StopModel | null, overlay: readonly StopModel[], stopTypeFilter: readonly string[]) => {
    const own = mapStopsOf(model, stopTypeFilter);
    if (overlay.length === 0) return own;
    const platformGrid = indexStops(own.platforms, SHARED_GROUND.TWIN_STOP_RADIUS_M);
    const stationGrid = indexStops(own.stations, SHARED_GROUND.TWIN_STATION_RADIUS_M);
    const stations: Station[] = [...own.stations];
    const platforms: Array<Platform | Entrance> = [...own.platforms];
    for (const network of overlay) {
        const other = mapStopsOf(network, stopTypeFilter);
        stations.push(...withoutTwins(other.stations, stationGrid, true));
        platforms.push(...withoutTwins(other.platforms, platformGrid, false));
    }
    return { stations, platforms };
};

/** The stop each of `ids` opens, for the ids the stop model knows. */
export const boardsOf = (model: StopModel | null | undefined, ids: readonly string[]): ReadonlyMap<string, BoardStop> => {
    const boards = new Map<string, BoardStop>();
    if (!model) return boards;
    for (const id of ids) {
        const board = resolveStop(model, id);
        if (board) boards.set(id, board);
    }
    return boards;
};

/** Whether two pins are the same pin. */
export const isSameFavoriteStop = (a: FavoriteStop, b: FavoriteStop): boolean => a.stopId === b.stopId && a.city === b.city;

/** The stops pinned in `city`, in pin order. */
export const favoriteStopsIn = (favorites: readonly FavoriteStop[], city: string): FavoriteStop[] =>
    favorites.filter(f => f.city === city);

/** Each network the map draws with the ids of its own pins, for `favoriteMarks`: the selected city's and each neighbour's (`StopModel.city`). */
export const pinsByNetwork = (favorites: readonly FavoriteStop[], ownCity: string, own: StopModel | null, overlay: readonly StopModel[]) =>
    [own, ...overlay].map(model => ({ model, pinIds: favoriteStopsIn(favorites, model?.city ?? ownCity).map(f => f.stopId) }));

/**
 * The pinned stops the stop model knows, in pin order, each kept with its pins so unpinning and reordering
 * write those back; a stop pinned under several ids (an alias, a pre-stops.json PID id) is listed once, at its first pin.
 */
export const pinnedStops = (model: StopModel | null | undefined, pins: readonly FavoriteStop[]): PinnedStop[] => {
    if (!model) return [];
    const byBoard = new Map<string, PinnedStop>();
    for (const pin of pins) {
        const stop = resolveStop(model, pin.stopId);
        if (!stop) continue;
        const listed = byBoard.get(stop.id);
        if (listed) listed.pins.push(pin);
        else byBoard.set(stop.id, { pin, pins: [pin], stop });
    }
    return [...byBoard.values()];
};

/** The id links and favorites name `id`'s stop by; `id` itself when the model does not know it. */
export const canonicalStopId = (model: StopModel | null | undefined, id: string): string =>
    (model && resolveStop(model, id)?.id) ?? id;

/** Whether `id`, in whichever form it was saved (an alias, a pre-stops.json PID id), opens the stop `boardId` names. */
export const opensStop = (model: StopModel | null | undefined, id: string, boardId: string): boolean =>
    id === boardId || canonicalStopId(model, id) === boardId;

/** The pins that open `boardId`'s stop, whichever id they were pinned under. */
export const pinsOf = (model: StopModel | null | undefined, pins: readonly FavoriteStop[], boardId: string): FavoriteStop[] =>
    pins.filter(pin => opensStop(model, pin.stopId, boardId));

/** The colour of `line` as the stop list records it for this stop, or undefined when the stop does not list it. */
export const lineColorAt = (stop: { lines: readonly StopLine[] } | null | undefined, line: string): string | undefined =>
    stop?.lines.find(l => l.name === line)?.route_color;

/** A search history entry for a stop picked in `city`. */
export const stopHistoryEntry = (stop: Stop, city: string): SearchHistoryBase => ({ type: 'stop', city_slug: city, stop_id: stop.id, stop_name: stop.name });

/** Search history as listed: each stop of `city` read from today's stop list (`model`), any other entry as stored. */
export const historyWithStops = (history: SearchHistoryItem[], model: StopModel | null, city: string): ShownHistoryItem[] =>
    mapStable(history, (item): ShownHistoryItem => {
        if (item.type !== 'stop' || !model || (item.city_slug ?? city) !== city) return item;
        const stop = resolveStop(model, item.stop_id);
        return stop ? { ...item, stop } : item;
    });
