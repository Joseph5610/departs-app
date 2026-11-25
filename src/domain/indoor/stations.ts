import type { IndoorIndex } from '@/types';
import type { Box } from '@/domain/cities';

const overlaps = (a: Box, b: Box): boolean => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/**
 * The station whose plan the map shows: of the plans on screen, the one whose centre is nearest the
 * screen's centre. Null without a plan on screen.
 */
export const activeIndoorStation = (index: IndoorIndex, view: Box): string | null => {
    const centerX = (view[0] + view[2]) / 2;
    const centerY = (view[1] + view[3]) / 2;
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const [id, { bbox }] of Object.entries(index.stations)) {
        if (!overlaps(bbox, view)) continue;
        const distance = ((bbox[0] + bbox[2]) / 2 - centerX) ** 2 + ((bbox[1] + bbox[3]) / 2 - centerY) ** 2;
        if (distance < bestDistance) { best = id; bestDistance = distance; }
    }
    return best;
};

/** A floor picked on one station's plan; it means nothing at another station. */
export interface IndoorFloorPick {
    station: string;
    level: number;
}

/** The floor shown at `station`: the one picked there, else street level, else the floor nearest it (the upper one on a tie). */
export const shownIndoorLevel = (levels: readonly number[], station: string, pick: IndoorFloorPick | null, streetLevel: number): number => {
    if (pick && pick.station === station && levels.includes(pick.level)) return pick.level;
    let best = levels[0] ?? streetLevel;
    for (const level of levels) {
        const [distance, bestDistance] = [Math.abs(level - streetLevel), Math.abs(best - streetLevel)];
        if (distance < bestDistance || (distance === bestDistance && level > best)) best = level;
    }
    return best;
};

/** The floor above (`up`) or below `level` among `levels` (ascending); null at the top or bottom. */
export const adjacentIndoorLevel = (levels: readonly number[], level: number, direction: 'up' | 'down'): number | null => {
    const index = levels.indexOf(level);
    if (index < 0) return null;
    return levels[direction === 'up' ? index + 1 : index - 1] ?? null;
};
