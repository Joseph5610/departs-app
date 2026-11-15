import type { RouteInfo } from '@/types';
import { kordisNumericId } from '@shared/lines';
import { DISRUPTION_PROTOCOL, type WatchedLine } from '@shared/alerts';

/**
 * Each line name with every raw value an alert may list it under, as `resolveLine` would resolve it: its route ids, its
 * name unless that is another route's id (rail line `L4` is not tram `L4`), and its KORDIS numeric ids unless a route id
 * or name already claims that value (`L99D99` is `N99`, not `99`). A line no value leads to is left out.
 */
export const alertKeysOfLines = (names: readonly string[], byId: ReadonlyMap<string, RouteInfo>, byName: ReadonlyMap<string, RouteInfo>): WatchedLine[] => {
    const wanted = new Set(names.map(name => name.toUpperCase()));
    const idsByName = new Map<string, string[]>();
    for (const [id, route] of byId) {
        const name = route.name.toUpperCase();
        if (!wanted.has(name)) continue;
        const ids = idsByName.get(name);
        if (ids) ids.push(id);
        else idsByName.set(name, [id]);
    }
    return names.map((name) => {
        const upper = name.toUpperCase();
        const ids = idsByName.get(upper) ?? [];
        const idOwner = byId.get(name) ?? byId.get(upper);
        const keys = new Set(idOwner && idOwner.name.toUpperCase() !== upper ? ids : [upper, ...ids]);
        for (const id of ids) {
            const numeric = kordisNumericId(id);
            if (numeric && !byName.has(numeric) && !byId.has(numeric)) keys.add(numeric);
        }
        return { name, keys: [...keys].slice(0, DISRUPTION_PROTOCOL.MAX_KEYS_PER_LINE) };
    }).filter(line => line.keys.length > 0).slice(0, DISRUPTION_PROTOCOL.MAX_LINES);
};
