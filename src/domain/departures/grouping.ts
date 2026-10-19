import type { StopFeature, Departure, FavoriteLine } from '@/types';
import { DEPARTURES_CONFIG } from '@/config/constants';
import { routeTypeRank } from '@/domain/routes/routeType';
import { boardingKey } from './platforms';
import { getOrCreate, mapStable } from '@/lib/memoize';

interface DepartureSubGroup {
    groupId: string;
    headsign: string;
    departures: Departure[];
    firstTime: number;
}

export interface DepartureLineGroup {
    lineGroupId: string;
    line: string | number;
    type: string | number;
    subGroups: DepartureSubGroup[];
    firstTime: number;
}

const soonest = (departures: Departure[]) => Math.min(...departures.map(d => Date.parse(d.timestamp)));

/** One line's departures merged across direction ids that share a headsign. */
interface Direction {
    ids: string[];
    byHeadsign: Map<string, Departure[]>;
}

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
            firstTime: soonest(deps),
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

/**
 * One platform's rows on a station board, named by its code (`platform`) or, without one, by the
 * direction it serves; both null for departures whose platform is unknown. `key` is its `boardingKey`.
 */
export interface PlatformSection {
    key: string;
    platform: string | null;
    direction: string | null;
    /** A metro line's section: each line numbers its own tracks, so its directions share one section. */
    metroLine: string | null;
    /** The metro line's colour, for its header badge. */
    metroColor: string | null;
    groups: DepartureLineGroup[];
}

/** The section a departure belongs to: its metro line, else its platform (`boardingKey`). */
const sectionKey = (dep: Departure) => dep.type === 'metro' ? `metro:${String(dep.line).toUpperCase()}` : boardingKey(dep);

/**
 * A station board's rows split by the platform each departure leaves from: metro lines first, one section
 * each, then coded platforms in natural order (`2` before `10`, `A` before `B`), then those named by
 * direction, unknown ones last; each sorted as the board is, favourite directions (`favorites`) first. Platforms serving one direction share a section. A row split across platforms gets a
 * `groupId` per platform, so each part expands on its own.
 */
export const platformSections = (groups: DepartureLineGroup[], departureSort: 'line' | 'departure', favorites: ReadonlySet<string> = new Set()): PlatformSection[] => {
    const byPlatform = new Map<string, DepartureLineGroup[]>();
    for (const group of groups) {
        const subsByPlatform = new Map<string, DepartureSubGroup[]>();
        for (const sub of group.subGroups) {
            const depsByPlatform = new Map<string, Departure[]>();
            for (const dep of sub.departures) getOrCreate(depsByPlatform, sectionKey(dep), (): Departure[] => []).push(dep);
            for (const [platform, departures] of depsByPlatform) {
                const part = depsByPlatform.size === 1 ? sub : { ...sub, groupId: `${sub.groupId}@${platform}`, departures, firstTime: soonest(departures) };
                getOrCreate(subsByPlatform, platform, (): DepartureSubGroup[] => []).push(part);
            }
        }
        for (const [platform, subGroups] of subsByPlatform) {
            const part = subsByPlatform.size === 1 ? group : { ...group, subGroups: [...subGroups].sort(byFirstTime), firstTime: Math.min(...subGroups.map(s => s.firstTime)) };
            getOrCreate(byPlatform, platform, (): DepartureLineGroup[] => []).push(part);
        }
    }
    const sections = [...byPlatform].map(([key, groups]): PlatformSection => {
        const dep = groups[0]!.subGroups[0]!.departures[0]!;
        const sorted = favoritesFirst(groups.sort(departureSort === 'line' ? byModeThenLine : byFirstTime), favorites);
        if (dep.type === 'metro') return { key, platform: null, direction: null, metroLine: String(dep.line).toUpperCase(), metroColor: dep.route_color ?? null, groups: sorted };
        return { key, platform: dep.platform ?? null, direction: dep.platform ? null : dep.platformDirection ?? null, metroLine: null, metroColor: null, groups: sorted };
    });
    const rank = (s: PlatformSection) => (s.metroLine ? 0 : s.platform ? 1 : s.direction ? 2 : 3);
    const label = (s: PlatformSection) => s.metroLine ?? s.platform ?? s.direction ?? '';
    return sections.sort((a, b) => rank(a) - rank(b) || label(a).localeCompare(label(b), undefined, { numeric: true }));
};

/** A station board's platform sections, or null when no departure names its platform and the board stays one list. */
export const stationBoardSections = (groups: DepartureLineGroup[], departureSort: 'line' | 'departure', favorites?: ReadonlySet<string>): PlatformSection[] | null => {
    const sections = platformSections(groups, departureSort, favorites);
    return sections.some(section => section.key) ? sections : null;
};

/**
 * The rows a platform section shows before "more": its first `limit` lines, or all of them when one further
 * down holds a marked trip (viewed, ridden or followed), which must stay visible. `hidden` counts the rest.
 */
export const sectionPreview = (groups: DepartureLineGroup[], limit: number, markedTripIds: ReadonlySet<string>): { shown: DepartureLineGroup[]; hidden: number } => {
    if (groups.length <= limit) return { shown: groups, hidden: 0 };
    const rest = groups.slice(limit);
    if (markedTripIds.size > 0 && rest.some(g => g.subGroups.some(s => s.departures.some(d => holdsTrip(d, markedTripIds))))) return { shown: groups, hidden: 0 };
    return { shown: groups.slice(0, limit), hidden: rest.length };
};

/** Whether `dep` is one of the marked trips (viewed, ridden or followed), which must never be folded away. */
const holdsTrip = (dep: Departure, tripIds: ReadonlySet<string>) => !!dep.tripId && tripIds.has(dep.tripId);

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
            if (hidden.some(dep => holdsTrip(dep, tripIds))) result.push(subGroup.groupId);
        }
    }
    return result;
};

/** Every line a rider follows: the pinned lines and all lines serving the pinned stops. */
export const favoriteLineNames = (lines: readonly FavoriteLine[], stops: readonly StopFeature[]): Set<string> => {
    const names = new Set<string>();
    for (const fav of lines) names.add(fav.line);
    for (const stop of stops) for (const line of stop.properties.lines ?? []) names.add(line.name);
    return names;
};
