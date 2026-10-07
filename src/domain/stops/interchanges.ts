import type { StopCollection } from '@/types';

/**
 * PID `stop_icons` codes, in PID's documented order: the modes a rider can change to at a stop.
 * `M*` codes are metro lines; the rest are modes.
 */
const INTERCHANGE_CODES = ['Ma', 'Mb', 'Mc', 'Md', 'Ra', 'Sb', 'Fu', 'Fe', 'Ap', 'Tw', 'Tb', 'Bu'] as const;

const RANK = new Map<string, number>(INTERCHANGE_CODES.map((code, i) => [code, i]));

/** Codes in PID order; unknown codes go last. */
const sortInterchanges = (codes: Iterable<string>): string[] =>
    [...codes].sort((a, b) => (RANK.get(a) ?? RANK.size) - (RANK.get(b) ?? RANK.size) || a.localeCompare(b));

/** Metro line name of an `M*` code (`Mc` -> `C`), or null for other modes. */
export const metroLineOf = (code: string): string | null => code.length === 2 && code[0] === 'M' ? code[1].toUpperCase() : null;

const NO_CODES: readonly string[] = [];

const nameKey = (name: string): string => name.trim().toUpperCase();

/** Interchange codes by stop name: departures and Golemio trip stops carry only the name, not the stop id. */
export const interchangeIndex = (collection: StopCollection | null): Map<string, readonly string[]> => {
    const byName = new Map<string, Set<string>>();
    for (const feature of collection?.features ?? []) {
        const { stop_name, interchanges } = feature.properties;
        if (!stop_name || !interchanges?.length) continue;
        const key = nameKey(stop_name);
        let codes = byName.get(key);
        if (!codes) {
            codes = new Set();
            byName.set(key, codes);
        }
        for (const code of interchanges) codes.add(code);
    }
    const sorted = new Map<string, readonly string[]>();
    for (const [key, codes] of byName) sorted.set(key, sortInterchanges(codes));
    return sorted;
};

/** A stop's interchange codes by name, without the metro line the rider is already on. */
export const interchangesWithoutLine = (index: Map<string, readonly string[]>, name: string | undefined, line: string): readonly string[] => {
    const codes = name ? index.get(nameKey(name)) ?? NO_CODES : NO_CODES;
    return codes.some(c => metroLineOf(c) === line) ? codes.filter(c => metroLineOf(c) !== line) : codes;
};
