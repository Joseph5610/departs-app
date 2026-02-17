
import { useMemo } from 'react';
import type { Departure } from '../types/transit';

/**
 * Hook to group raw departures into logical sections for the UI.
 * Metro lines are grouped by both line and direction, while others are grouped by line only.
 * Supports sorting by line type/number or by next departure time.
 *
 * @param departures - The raw departures object from the API.
 * @param departureSort - The preferred sorting method ('line' or 'departure').
 * @returns An array of grouped departure objects.
 */
export const useGroupedDepartures = (departures: { departures: Departure[] } | null | undefined, departureSort: 'line' | 'departure') => {
    return useMemo(() => {
        if (!departures?.departures) return [];
        const groups: Record<string, Departure[]> = {};
        departures.departures.forEach((dep) => {
            // Metro (type 1) is grouped by line AND direction
            const lineName = String(dep.line).toUpperCase();
            const isMetro = String(dep.type) === '1' || ['A', 'B', 'C'].includes(lineName);
            const key = isMetro ? `${lineName}-${dep.directionId}` : lineName;
            if (!groups[key]) groups[key] = [];
            groups[key].push(dep);
        });

        const result = Object.entries(groups).map(([key, deps]) => ({
            groupId: key,
            line: deps[0].line,
            type: deps[0].type,
            departures: deps,
            firstTime: new Date(deps[0].timestamp).getTime()
        }));

        if (departureSort === 'line') {
            result.sort((a, b) => {
                const typeA = Number(a.type) || 0;
                const typeB = Number(b.type) || 0;
                if (typeA !== typeB) return typeA - typeB;

                const lineA = String(a.line);
                const lineB = String(b.line);
                if (lineA !== lineB) return lineA.localeCompare(lineB, undefined, { numeric: true, sensitivity: 'base' });

                return a.firstTime - b.firstTime;
            });
        } else {
            // Sort by departure time
            result.sort((a, b) => a.firstTime - b.firstTime);
        }
        return result;
    }, [departures, departureSort]);
};
