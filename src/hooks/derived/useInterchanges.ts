import { useMemo } from 'react';
import { useStops } from '../data/useStops';
import { memoizeLast } from '../../lib/memoize';
import { metroLineOf, sortInterchanges } from '../../utils/interchanges';
import type { StopCollection } from '../../types/transit';

const NO_CODES: readonly string[] = [];

const nameKey = (name: string): string => name.trim().toUpperCase();

/** Interchange codes by stop name: departures and Golemio trip stops carry only the name, not the stop id. */
const buildInterchangeIndex = memoizeLast((collection: StopCollection | null) => {
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
});

/**
 * useInterchanges
 *
 * The modes a rider can change to at a stop (PID `stop_icons` codes), looked up by stop name.
 */
export const useInterchanges = () => {
    const { allFeatures } = useStops();
    const index = buildInterchangeIndex(allFeatures);

    return useMemo(() => {
        const forName = (name: string | undefined): readonly string[] =>
            name ? index.get(nameKey(name)) ?? NO_CODES : NO_CODES;

        const withoutLine = (name: string | undefined, line: string): readonly string[] => {
            const codes = forName(name);
            return codes.some(c => metroLineOf(c) === line) ? codes.filter(c => metroLineOf(c) !== line) : codes;
        };

        return {
            /** Interchanges at a departure's destination, without the departing metro line itself. */
            forHeadsign: withoutLine,
            /** Interchanges at a timeline stop, without the metro line the vehicle itself runs on. */
            forStop: withoutLine,
        };
    }, [index]);
};
