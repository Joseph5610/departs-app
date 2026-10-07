import type { LineRules } from '@/config/cities';
import { ROUTE_TYPE_ORDER } from '@/config/transit';
import { routeTypeRank } from '@/domain/routes/routeType';
import type { DepartureFeeder } from '@/types';

interface LineChip {
    name: string;
    type: string;
    route_color: string;
}

/**
 * A stop's line filter chips, one per line name: metro, then trains (by type or the city's train
 * prefixes), then the other modes in mode order with night lines after the day lines of their mode.
 */
export const lineChips = <T extends LineChip>(lines: T[], rules: LineRules): T[] => {
    const seen = new Set<string>();
    const unique = lines.filter(line => {
        if (seen.has(line.name)) return false;
        seen.add(line.name);
        return true;
    });

    const groupOf = (line: LineChip) => {
        const name = line.name.toUpperCase();
        if (line.type === 'metro') return routeTypeRank('metro');
        if (line.type === 'train' || rules.trainLinePrefixes.some(prefix => name.startsWith(prefix))) return routeTypeRank('train');
        const rank = routeTypeRank(line.type);
        return rules.isNightLine(line.type, name) ? rank + ROUTE_TYPE_ORDER.length + 1 : rank;
    };

    return unique.sort((a, b) => {
        const groupA = groupOf(a);
        const groupB = groupOf(b);
        if (groupA !== groupB) return groupA - groupB;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
};

/** `[line, colour]` per distinct line name, in first-seen order. */
export const distinctLines = (items: ReadonlyArray<{ line: string; route_color?: string }>): Array<[string, string]> => {
    const byName = new Map<string, string>();
    for (const item of items) if (!byName.has(item.line)) byName.set(item.line, item.route_color ?? '');
    return [...byName];
};

export interface FeederSummary {
    /** Lines the departure will not wait for. */
    missed: string[];
    /** The feeder holding the departure longest, when it holds it at least a minute. */
    held: DepartureFeeder | null;
    heldMinutes: number;
}

export const summarizeFeeders = (feeders: DepartureFeeder[]): FeederSummary => {
    const missed: string[] = [];
    let held: DepartureFeeder | null = null;
    for (const f of feeders) {
        if (f.will_miss) missed.push(f.line);
        else if (f.hold_s !== null && f.hold_s >= 60 && (!held || f.hold_s > (held.hold_s ?? 0))) held = f;
    }
    return { missed, held, heldMinutes: held ? Math.round((held.hold_s ?? 0) / 60) : 0 };
};
