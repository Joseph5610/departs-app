import { ROUTE_PROGRESS_CONFIG } from '../config/constants';
import { DEG, EARTH_RADIUS_M } from './geo';

type LngLat = [number, number];

/** A route line flattened to local metres, with each point's distance along it. */
export interface MeasuredLine {
    coordinates: LngLat[];
    xy: LngLat[];
    along: number[];
    toXY: (point: LngLat) => LngLat;
}

interface Projection {
    along: number;
    offsetSq: number;
}

/** Equirectangular metres around the line's first point; exact enough over a city-sized route. */
export function measureLine(coordinates: LngLat[]): MeasuredLine {
    const [lng0, lat0] = coordinates[0];
    const kx = Math.cos(lat0 * DEG) * DEG * EARTH_RADIUS_M;
    const ky = DEG * EARTH_RADIUS_M;
    const toXY = ([lng, lat]: LngLat): LngLat => [(lng - lng0) * kx, (lat - lat0) * ky];

    const xy = coordinates.map(toXY);
    const along = new Array<number>(xy.length);
    along[0] = 0;
    for (let i = 1; i < xy.length; i++) {
        along[i] = along[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]);
    }
    return { coordinates, xy, along, toXY };
}

/** The place on the line between `from` and `to` metres closest to `point`, or with `preferEarliest` the first one within the snap tolerance of it. */
function project(line: MeasuredLine, point: LngLat, from: number, to: number, preferEarliest: boolean): Projection | null {
    const [px, py] = line.toXY(point);
    const { xy, along } = line;
    const candidates: Projection[] = [];
    let best: Projection | null = null;

    for (let i = 0; i < xy.length - 1; i++) {
        if (along[i + 1] < from) continue;
        if (along[i] > to) break;
        const [ax, ay] = xy[i];
        const dx = xy[i + 1][0] - ax;
        const dy = xy[i + 1][1] - ay;
        const lenSq = dx * dx + dy * dy;
        const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;
        const segAlong = Math.max(from, Math.min(to, along[i] + t * (along[i + 1] - along[i])));
        const segT = along[i + 1] > along[i] ? (segAlong - along[i]) / (along[i + 1] - along[i]) : 0;
        const ox = ax + segT * dx - px;
        const oy = ay + segT * dy - py;
        const candidate = { along: segAlong, offsetSq: ox * ox + oy * oy };
        candidates.push(candidate);
        if (!best || candidate.offsetSq < best.offsetSq) best = candidate;
    }
    if (!best || !preferEarliest) return best;

    const limit = (Math.sqrt(best.offsetSq) + ROUTE_PROGRESS_CONFIG.STOP_SNAP_TOLERANCE_M) ** 2;
    for (const candidate of candidates) {
        if (candidate.offsetSq <= limit) return candidate;
    }
    return best;
}

/** Each stop's distance along the line, never behind the one before it, so loops and repeated stops keep their order; an unlocated stop sits at the one before it. */
export function locateStops(line: MeasuredLine, stops: Array<LngLat | null>): number[] {
    const total = line.along[line.along.length - 1];
    const result: number[] = [];
    let from = 0;
    for (const stop of stops) {
        if (stop) from = project(line, stop, from, total, true)?.along ?? from;
        result.push(from);
    }
    return result;
}

/** Where a vehicle is reported or seen, for placing it on its line. */
export interface ProgressHints {
    /** The network's distance of each shape point, when it publishes them. */
    shapeDistances?: number[];
    /** The vehicle's own distance in the same units as `shapeDistances`. */
    reportedDistance?: number;
    /** Index into the located stops of the stop the feed reports the vehicle at. */
    stopIndex: number | null;
    position: LngLat | null;
}

/** A published shape distance converted to metres along the measured line, interpolated between its points. */
function fromShapeDistance(line: MeasuredLine, shapeDistances: number[], reported: number): number {
    const { along } = line;
    if (reported <= shapeDistances[0]) return 0;
    for (let i = 0; i < shapeDistances.length - 1; i++) {
        if (reported < shapeDistances[i + 1]) {
            const span = shapeDistances[i + 1] - shapeDistances[i];
            const t = span > 0 ? (reported - shapeDistances[i]) / span : 0;
            return along[i] + t * (along[i + 1] - along[i]);
        }
    }
    return along[along.length - 1];
}

/**
 * How far along the line a vehicle is, in metres: from its reported shape distance where the network
 * publishes one, else estimated from its position, searched only around its reported stop when one is known.
 * Null when neither places it, or it is too far from the line to be on it.
 */
export function resolveProgress(line: MeasuredLine, stopAlong: number[], hints: ProgressHints): number | null {
    const { shapeDistances, reportedDistance, stopIndex, position } = hints;
    if (shapeDistances && shapeDistances.length === line.along.length && reportedDistance !== undefined) {
        return fromShapeDistance(line, shapeDistances, reportedDistance);
    }

    const total = line.along[line.along.length - 1];
    if (!position) return stopIndex !== null ? stopAlong[stopIndex] ?? null : null;

    const reach = ROUTE_PROGRESS_CONFIG.STOP_WINDOW;
    const from = stopIndex !== null ? stopAlong[stopIndex - reach] ?? 0 : 0;
    const to = stopIndex !== null ? stopAlong[stopIndex + reach] ?? total : total;
    const hit = project(line, position, from, to, false);
    if (!hit || hit.offsetSq > ROUTE_PROGRESS_CONFIG.MAX_OFFSET_M ** 2) return null;
    return hit.along;
}

/** The line cut at `distance` metres, the cut point interpolated so both halves meet exactly there. */
export function splitLineAt(line: MeasuredLine, distance: number): { traversed: LngLat[]; upcoming: LngLat[] } {
    const { coordinates, along } = line;
    let i = 0;
    while (i < along.length - 2 && along[i + 1] <= distance) i++;
    const span = along[i + 1] - along[i];
    const t = span > 0 ? Math.max(0, Math.min(1, (distance - along[i]) / span)) : 0;
    const [aLng, aLat] = coordinates[i];
    const [bLng, bLat] = coordinates[i + 1];
    const cut: LngLat = [aLng + t * (bLng - aLng), aLat + t * (bLat - aLat)];
    return {
        traversed: [...coordinates.slice(0, i + 1), cut],
        upcoming: [cut, ...coordinates.slice(i + 1)],
    };
}
