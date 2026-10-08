import type { Departure, FavoriteLine } from '@/types';
import { DEPARTURES_CONFIG } from '@/config/constants';
import { routeTypeRank } from '@/domain/routes/routeType';
import { mapStable } from '@/lib/memoize';

interface DepartureSubGroup {
    groupId: string;
    headsign: string;
    departures: Departure[];
    firstTime: number;
}

interface DepartureLineGroup {
    lineGroupId: string;
    line: string | number;
    type: string | number;
    subGroups: DepartureSubGroup[];
    firstTime: number;
}

/** One line's departures merged across direction ids that share a headsign. */
interface Direction {
    ids: string[];
    byHeadsign: Map<string, Departure[]>;
}

const getOrCreate = <K, V>(map: Map<K, V>, key: K, create: () => V): V => {
    let value = map.get(key);
    if (value === undefined) map.set(key, value = create());
    return value;
};

/** Feeds sometimes flip direction_id within one headsign, so a direction joins the first one sharing any of its headsigns. */
const mergeDirections = (directions: Map<string, Map<string, Departure[]>>): Direction[] => {
    const merged: Direction[] = [];
    const byHeadsign = new Map<string, Direction>();
    for (const [directionId, headsigns] of directions) {
        let target: Direction | undefined;
        for (const headsign of headsigns.keys()) {
            target = byHeadsign.get(headsign);
            if (target) break;
        }
        if (!target) merged.push(target = { ids: [], byHeadsign: new Map() });
        target.ids.push(directionId);
        for (const [headsign, deps] of headsigns) {
            getOrCreate(target.byHeadsign, headsign, (): Departure[] => []).push(...deps);
            byHeadsign.set(headsign, target);
        }
    }
    return merged;
};

const byFirstTime = (a: { firstTime: number }, b: { firstTime: number }) => a.firstTime - b.firstTime;

const toLineGroup = (line: string, { ids, byHeadsign }: Direction): DepartureLineGroup => {
    const lineGroupId = `${line}-${ids.join('_')}`;
    const subGroups = [...byHeadsign]
        .map(([headsign, deps]): DepartureSubGroup => ({
            groupId: `${lineGroupId}-${headsign}`,
            headsign,
            departures: deps.sort((a, b) => Date.parse(a.scheduled) - Date.parse(b.scheduled)),
            firstTime: Math.min(...deps.map(d => Date.parse(d.timestamp))),
        }))
        .sort(byFirstTime);
    const first = subGroups[0].departures[0];
    return { lineGroupId, line: first.line, type: first.type, subGroups, firstTime: subGroups[0].firstTime };
};

const byModeThenLine = (a: DepartureLineGroup, b: DepartureLineGroup) => {
    const rankDiff = routeTypeRank(a.type) - routeTypeRank(b.type);
    if (rankDiff !== 0) return rankDiff;
    const lineA = String(a.line);
    const lineB = String(b.line);
    if (lineA !== lineB) return lineA.localeCompare(lineB, undefined, { numeric: true, sensitivity: 'base' });
    return a.firstTime - b.firstTime;
};

/**
 * The board's rows: per line, one group per direction (metro A/B/C directions are distinct), each split
 * by headsign. Sorted by mode then line number, or by the soonest departure.
 */
export const groupDepartures = (departures: Departure[], departureSort: 'line' | 'departure'): DepartureLineGroup[] => {
    const byLine = new Map<string, Map<string, Map<string, Departure[]>>>();
    for (const dep of departures) {
        const directions = getOrCreate(byLine, String(dep.line).toUpperCase(), () => new Map<string, Map<string, Departure[]>>());
        const headsigns = getOrCreate(directions, String(dep.directionId ?? ''), () => new Map<string, Departure[]>());
        getOrCreate(headsigns, dep.headsign, (): Departure[] => []).push(dep);
    }
    const groups = [...byLine].flatMap(([line, directions]) => mergeDirections(directions).map(direction => toLineGroup(line, direction)));
    return groups.sort(departureSort === 'line' ? byModeThenLine : byFirstTime);
};

export const favoriteKey = (line: string | number, headsign: string) => `${String(line).toUpperCase()}|${headsign}`;

/** Favourite line directions first, keeping the chosen sort within each part; inside a line, its favourite direction leads. */
export const favoritesFirst = (groups: DepartureLineGroup[], favorites: ReadonlySet<string>): DepartureLineGroup[] => {
    if (favorites.size === 0) return groups;
    const pinned: DepartureLineGroup[] = [];
    const rest: DepartureLineGroup[] = [];
    for (const group of groups) {
        const favSubs: DepartureSubGroup[] = [];
        const otherSubs: DepartureSubGroup[] = [];
        for (const sub of group.subGroups) {
            (favorites.has(favoriteKey(group.line, sub.headsign)) ? favSubs : otherSubs).push(sub);
        }
        if (favSubs.length === 0) rest.push(group);
        else pinned.push({ ...group, subGroups: [...favSubs, ...otherSubs] });
    }
    return pinned.length > 0 ? [...pinned, ...rest] : groups;
};

export const isSameFavoriteLine = (a: FavoriteLine, b: FavoriteLine): boolean =>
    a.city === b.city && a.stopId === b.stopId && a.line === b.line && a.headsign === b.headsign;

/**
 * `all` with the pins in `shown` put in `shown`'s order, each into a slot one of them held, so pins the
 * panel does not show (another city's) keep their places; `all` itself when the order is unchanged.
 */
export const reorderShown = <T>(all: T[], shown: readonly T[]): T[] => {
    const shownSet = new Set(shown);
    let next = 0;
    return mapStable(all, item => (shownSet.has(item) && next < shown.length ? shown[next++] : item));
};

/** `shown` with `item` moved `delta` places, kept within the list; `shown` itself when it cannot move. */
export const moveShown = <T>(shown: readonly T[], item: T, delta: number): readonly T[] => {
    const from = shown.indexOf(item);
    const to = Math.min(Math.max(from + delta, 0), shown.length - 1);
    if (from === -1 || to === from) return shown;
    const next = shown.filter(other => other !== item);
    next.splice(to, 0, item);
    return next;
};

/** The lines pinned in one city, in pin order. */
export const favoriteLinesIn = (favorites: FavoriteLine[], city: string): FavoriteLine[] =>
    favorites.filter(fav => fav.city === city);

/**
 * What the favourites panel lists: with both lines and stops pinned it shows tabs and only the open
 * tab's pins, otherwise everything pinned.
 */
export const favoritesView = <S>(lines: FavoriteLine[], stops: S[], tab: 'lines' | 'stops') => {
    const hasTabs = lines.length > 0 && stops.length > 0;
    return {
        hasTabs,
        lines: !hasTabs || tab === 'lines' ? lines : [],
        stops: !hasTabs || tab === 'stops' ? stops : [],
    };
};

/** `favoriteKey`s of the lines pinned at one stop of one city. */
export const favoriteKeysAt = (favorites: FavoriteLine[], city: string, stopId: string | null): string[] =>
    favorites.filter(fav => fav.city === city && fav.stopId === stopId).map(fav => favoriteKey(fav.line, fav.headsign));

/**
 * The departures a line group shows. Collapsed groups show the first few, except that a single hidden
 * departure is shown rather than hidden behind an expand button; a filtered board shows all.
 */
export const visibleInGroup = (departures: Departure[], isExpanded: boolean, isFiltered: boolean) => {
    const perGroup = DEPARTURES_CONFIG.VISIBLE_PER_GROUP;
    const showAllByDefault = departures.length - perGroup === 1;
    const visible = isExpanded || isFiltered || showAllByDefault ? departures : departures.slice(0, perGroup);
    return {
        visible,
        hiddenCount: departures.length - visible.length,
        hasMore: !showAllByDefault && departures.length > perGroup && !isFiltered,
    };
};

/** Line groups that hide one of `tripIds` beyond their collapsed rows, so the board can open them. */
export const groupsHidingTrips = (groups: DepartureLineGroup[], tripIds: ReadonlySet<string>): string[] => {
    const result: string[] = [];
    for (const lineGroup of groups) {
        for (const subGroup of lineGroup.subGroups) {
            const hidden = subGroup.departures.slice(DEPARTURES_CONFIG.VISIBLE_PER_GROUP);
            if (hidden.some(dep => !!dep.tripId && tripIds.has(dep.tripId))) result.push(subGroup.groupId);
        }
    }
    return result;
};
