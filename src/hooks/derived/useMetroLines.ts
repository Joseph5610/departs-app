import { useMemo } from 'react';
import { useStops } from '../data/useStops';
import { memoizeLast } from '../../lib/memoize';
import type { StopCollection } from '../../types/transit';

export interface MetroLine {
    name: string;
    route_color: string;
}

const NO_LINES: readonly MetroLine[] = [];

/** PID node number shared by every platform of a station (`U1040Z1P`, `U1040N3`, `centroid-U1040S1` -> `U1040`). */
const nodeOf = (stopId: string): string | undefined => stopId.match(/^(?:centroid-)?(U\d+)/)?.[1];

const nameKey = (name: string): string => name.trim().toUpperCase();

const addLines = (index: Map<string, Map<string, MetroLine>>, key: string | undefined, lines: readonly MetroLine[]) => {
    if (!key) return;
    let entry = index.get(key);
    if (!entry) {
        entry = new Map();
        index.set(key, entry);
    }
    for (const line of lines) entry.set(line.name, line);
};

const sortedLines = (entry: Map<string, MetroLine> | undefined): readonly MetroLine[] =>
    entry && entry.size > 0 ? [...entry.values()].sort((a, b) => a.name.localeCompare(b.name)) : NO_LINES;

/**
 * Metro lines by station node and by stop name. Only metro station features carry `metro_lines`, so a
 * tram or bus platform inherits them from the station sharing its node number or its name.
 */
const buildMetroIndex = memoizeLast((collection: StopCollection | null) => {
    const byNode = new Map<string, Map<string, MetroLine>>();
    const byName = new Map<string, Map<string, MetroLine>>();
    const nodesByName = new Map<string, Set<string>>();

    for (const feature of collection?.features ?? []) {
        const { stop_id, stop_name, metro_lines, location_type } = feature.properties;
        if (!stop_name || Number(location_type) === 2) continue;
        const name = nameKey(stop_name);
        const ids = stop_id.split(',');

        let nodes = nodesByName.get(name);
        if (!nodes) {
            nodes = new Set();
            nodesByName.set(name, nodes);
        }
        for (const id of ids) {
            const node = nodeOf(id);
            if (node) nodes.add(node);
        }

        if (!metro_lines || metro_lines.length === 0) continue;
        addLines(byName, name, metro_lines);
        for (const id of ids) addLines(byNode, nodeOf(id), metro_lines);
    }

    const nameLines = new Map<string, readonly MetroLine[]>();
    for (const [name, nodes] of nodesByName) {
        const merged = new Map(byName.get(name));
        for (const node of nodes) {
            for (const line of byNode.get(node)?.values() ?? []) merged.set(line.name, line);
        }
        const lines = sortedLines(merged);
        if (lines.length > 0) nameLines.set(name, lines);
    }

    return { byNode, nameLines };
});

/**
 * useMetroLines
 *
 * Resolves the metro lines serving a stop or a headsign from the city's cached stop list.
 */
export const useMetroLines = () => {
    const { allFeatures } = useStops();
    const index = buildMetroIndex(allFeatures);

    return useMemo(() => {
        const forName = (name: string | undefined): readonly MetroLine[] =>
            name ? index.nameLines.get(nameKey(name)) ?? NO_LINES : NO_LINES;

        return {
            /** Metro lines at a departure's destination, without the departing line itself. */
            forHeadsign: (headsign: string, line: string): readonly MetroLine[] => {
                const lines = forName(headsign);
                return lines.some(l => l.name === line) ? lines.filter(l => l.name !== line) : lines;
            },
            /** Metro lines at a timeline stop, by its station node and its name. */
            forStop: (stopId: string, stopName: string | undefined): readonly MetroLine[] => {
                const node = nodeOf(stopId);
                const nodeLines = node ? index.byNode.get(node) : undefined;
                const nameLines = forName(stopName);
                if (!nodeLines) return nameLines;
                const merged = new Map(nodeLines);
                for (const line of nameLines) merged.set(line.name, line);
                return sortedLines(merged);
            },
        };
    }, [index]);
};
