import type { AppDeparture, AppDepartureResponse } from '../../_core/types';

const expectedMs = (dep: AppDeparture) => Date.parse(dep.timestamp || dep.scheduled);

/**
 * Each stop's departures cut to the next `perLine` of every line and direction, in expected-time order;
 * cancelled ones ride along without counting, so a card skipping them still finds `perLine`.
 */
export function capPerLine({ departures }: AppDepartureResponse, perLine: number): AppDepartureResponse {
    const counts = new Map<string, number>();
    return {
        departures: [...departures].sort((a, b) => expectedMs(a) - expectedMs(b)).filter(dep => {
            const key = `${dep.stopId}|${dep.line}|${dep.headsign}`;
            const count = counts.get(key) ?? 0;
            if (count >= perLine) return false;
            if (!dep.isCanceled) counts.set(key, count + 1);
            return true;
        }),
    };
}
