import type { StopCollection, StopFeature } from '../types/transit';
import { DEG, EARTH_RADIUS_M } from './geo';

/** Grid cell for the twin lookup: a latitude degree is about this many metres. */
const METRES_PER_DEG_LAT = DEG * EARTH_RADIUS_M;

/** Stops carrying their network's map colour; the collection itself for a network without one. */
export function withStopColor(collection: StopCollection | null, color: string | undefined): StopCollection | null {
    if (!collection || !color) return collection;
    return { ...collection, features: collection.features.map(f => ({ ...f, properties: { ...f.properties, stop_color: color } })) };
}

/** Name compared across networks, which punctuate and space stop names differently. */
export const stopNameKey = (name: string | undefined): string =>
    (name ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Stops bucketed on a grid of `radiusM` cells, so the stops near a point are the ones in its 9 cells. */
export interface StopGrid {
    radiusM: number;
    cells: Map<string, StopFeature[]>;
}

const cellOf = ([lng, lat]: [number, number], radiusM: number): [number, number] => {
    const step = radiusM / METRES_PER_DEG_LAT;
    return [Math.floor(lng / step), Math.floor(lat / step)];
};

export function indexStops(collection: StopCollection | null, radiusM: number): StopGrid {
    const cells = new Map<string, StopFeature[]>();
    for (const f of collection?.features ?? []) {
        const [x, y] = cellOf(f.geometry.coordinates as [number, number], radiusM);
        const key = `${x}|${y}`;
        const bucket = cells.get(key);
        if (bucket) bucket.push(f);
        else cells.set(key, [f]);
    }
    return { radiusM, cells };
}

/** The indexed stop nearest `point` within the grid's radius, optionally only one with the given name key. */
export function stopNear(grid: StopGrid, point: [number, number], nameKey?: string): StopFeature | undefined {
    const [x, y] = cellOf(point, grid.radiusM);
    const kx = Math.cos(point[1] * DEG) * METRES_PER_DEG_LAT;
    let best: StopFeature | undefined;
    let bestSq = grid.radiusM ** 2;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (const f of grid.cells.get(`${x + dx}|${y + dy}`) ?? []) {
                if (nameKey !== undefined && stopNameKey(f.properties.stop_name) !== nameKey) continue;
                const [lng, lat] = f.geometry.coordinates;
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
export function withoutTwins(other: StopCollection | null, own: StopGrid, byName: boolean): StopCollection | null {
    if (!other?.features.length || own.cells.size === 0) return other;
    const features = other.features.filter(f =>
        !stopNear(own, f.geometry.coordinates as [number, number], byName ? stopNameKey(f.properties.stop_name) : undefined));
    return features.length === other.features.length ? other : { ...other, features };
}
