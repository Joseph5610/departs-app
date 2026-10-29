import type { StopModel, StopTimeFeature } from '@/types';
import { DEG } from '@/lib/geo';
import { nameKey } from '@shared/text';
import { EARTH_RADIUS_M } from '@shared/geo';

/** Grid cell for the twin lookup: a latitude degree is about this many metres. */
const METRES_PER_DEG_LAT = DEG * EARTH_RADIUS_M;

/** Name compared across networks, which punctuate and space stop names differently. */
export const stopNameKey = (name: string | undefined): string =>
    nameKey(name ?? '');

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

/** The indexed stop nearest `point` within the grid's radius, optionally only one with the given name key. */
export function stopNear<T extends Placed>(grid: StopGrid<T>, point: [number, number], nameKey?: string): T | undefined {
    const [x, y] = cellOf(point, grid.radiusM);
    const kx = Math.cos(point[1] * DEG) * METRES_PER_DEG_LAT;
    let best: T | undefined;
    let bestSq = grid.radiusM ** 2;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (const f of grid.cells.get(`${x + dx}|${y + dy}`) ?? []) {
                if (nameKey !== undefined && stopNameKey(f.name) !== nameKey) continue;
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
    const kept = other.filter(f => !stopNear(own, f.pos, byName ? stopNameKey(f.name) : undefined));
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
    const nameKey = stopNameKey(stop.properties.stop_name);
    const boardable = point && (stopNear(stations, point, nameKey) ?? stopNear(platforms, point, nameKey));
    return boardable ? boardable.id : known?.id ?? stopId;
}
