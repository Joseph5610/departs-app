import type { StopModel, StopTimeFeature } from '@/types';
import { DEG } from '@/lib/geo';
import { foldDiacritics, nameKey } from '@shared/text';
import { EARTH_RADIUS_M } from '@shared/geo';

/** Grid cell for the twin lookup: a latitude degree is about this many metres. */
const METRES_PER_DEG_LAT = DEG * EARTH_RADIUS_M;

/** One word of a stop name; `short` when written abbreviated (`nádr.`), so it stands for any word it begins. */
interface NameWord { text: string; short: boolean }
type NameWords = { town: number; words: NameWord[] };

const wordsCache = new Map<string, NameWords>();

/** The name's words, and how many lead it before its first comma (its town, where it names one). */
function nameWords(name: string): NameWords {
    const cached = wordsCache.get(name);
    if (cached) return cached;
    const [head, ...rest] = foldDiacritics(name).split(',');
    const split = (part: string): NameWord[] => [...part.matchAll(/([a-z0-9]+)(\.?)/g)].map(m => ({ text: m[1], short: m[2] === '.' }));
    const town = rest.length > 0 ? split(head).length : 0;
    const result = { town, words: [...split(head), ...rest.flatMap(split)] };
    wordsCache.set(name, result);
    return result;
}

const sameWord = (a: NameWord, b: NameWord) =>
    a.text === b.text || (a.short && b.text.startsWith(a.text)) || (b.short && a.text.startsWith(b.text));

const sameWords = (a: readonly NameWord[], b: readonly NameWord[]) => a.length === b.length && a.every((w, i) => sameWord(w, b[i]));

/**
 * Whether two networks name the same stop: alike once punctuation is set aside, an abbreviated word standing
 * for any it begins (`Roudnice n.L.,aut.nádr.` is `Roudnice nad Labem,autobusové nádraží`), and one name
 * possibly prefixed by its town (`Praha,Letňany` is `Letňany`).
 */
export function sameStopName(a: string, b: string): boolean {
    if (nameKey(a) === nameKey(b)) return true;
    const wa = nameWords(a), wb = nameWords(b);
    return sameWords(wa.words, wb.words)
        || (wa.town > 0 && sameWords(wa.words.slice(wa.town), wb.words))
        || (wb.town > 0 && sameWords(wa.words, wb.words.slice(wb.town)));
}

/** What the twin lookup reads of a stop. */
type Placed = { pos: [number, number]; name: string };

/** Stops bucketed on a grid of `radiusM` cells, so the stops near a point are the ones in its 9 cells. */
export interface StopGrid<T extends Placed = Placed> {
    radiusM: number;
    cells: Map<string, T[]>;
}

const cellOf = ([lng, lat]: [number, number], radiusM: number): [number, number] => {
    const step = radiusM / METRES_PER_DEG_LAT;
    return [Math.floor(lng / step), Math.floor(lat / step)];
};

export function indexStops<T extends Placed>(stops: readonly T[], radiusM: number): StopGrid<T> {
    const cells = new Map<string, T[]>();
    for (const f of stops) {
        const [x, y] = cellOf(f.pos, radiusM);
        const key = `${x}|${y}`;
        const bucket = cells.get(key);
        if (bucket) bucket.push(f);
        else cells.set(key, [f]);
    }
    return { radiusM, cells };
}

/** The indexed stop nearest `point` within the grid's radius, optionally only one of the same name (`sameStopName`). */
export function stopNear<T extends Placed>(grid: StopGrid<T>, point: [number, number], name?: string): T | undefined {
    const [x, y] = cellOf(point, grid.radiusM);
    const kx = Math.cos(point[1] * DEG) * METRES_PER_DEG_LAT;
    let best: T | undefined;
    let bestSq = grid.radiusM ** 2;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (const f of grid.cells.get(`${x + dx}|${y + dy}`) ?? []) {
                if (name !== undefined && !sameStopName(f.name, name)) continue;
                const [lng, lat] = f.pos;
                const ex = (lng - point[0]) * kx;
                const ey = (lat - point[1]) * METRES_PER_DEG_LAT;
                const dSq = ex * ex + ey * ey;
                if (dSq <= bestSq) { bestSq = dSq; best = f; }
            }
        }
    }
    return best;
}

/**
 * `other` without the stops the selected network already draws at the same place: platforms within
 * the grid's radius, or with `byName` stations of the same name. Returns `other` itself when none is left out.
 */
export function withoutTwins<T extends Placed>(other: readonly T[], own: StopGrid, byName: boolean): readonly T[] {
    if (!other.length || own.cells.size === 0) return other;
    const kept = other.filter(f => !stopNear(own, f.pos, byName ? f.name : undefined));
    return kept.length === other.length ? other : kept;
}

/**
 * The stop whose board a timeline stop opens: itself; for an arrival-only platform (a terminus) its station;
 * where that has no departures either, or the stop list lacks the stop, the nearby same-named station or
 * platform that has departures.
 */
export function boardableStopId(stop: StopTimeFeature, model: StopModel | null, stations: StopGrid<{ id: string } & Placed>, platforms: StopGrid<{ id: string } & Placed>): string {
    const stopId = String(stop.properties.stop_id);
    const known = model?.byId.get(stopId);
    if (known && !known.alightOnly) return known.id;
    const station = known?.kind === 'platform' ? model?.stationsById.get(known.station) : undefined;
    if (station && !station.alightOnly) return station.id;
    const point = (stop.geometry?.coordinates ?? known?.pos) as [number, number] | undefined;
    const name = stop.properties.stop_name ?? '';
    const boardable = point && (stopNear(stations, point, name) ?? stopNear(platforms, point, name));
    return boardable ? boardable.id : known?.id ?? stopId;
}
