import { isWithinLocalHours } from '@/domain/time';
import type { Departure } from '@/types';

export const filterDepartures = (departures: Departure[], selectedLine: string | null, requireAirConditioned: boolean, requireWheelchairAccessible: boolean) => {
    const hasAirConditioningData = departures.some(dep => dep.is_air_conditioned === true);
    const hasAccessibilityData = departures.some(dep => dep.is_wheelchair_accessible === true);
    const hasRequestStop = departures.some(dep => dep.is_request_stop === true);

    let filtered = departures;
    if (selectedLine) {
        filtered = filtered.filter(dep => String(dep.line).toUpperCase() === selectedLine.toUpperCase());
    }
    // Ignore the persistent AC preference at stops without AC data, so the board never goes empty unexpectedly.
    if (requireAirConditioned && hasAirConditioningData) {
        filtered = filtered.filter(dep => dep.is_air_conditioned === true);
    }
    if (requireWheelchairAccessible && hasAccessibilityData) {
        filtered = filtered.filter(dep => dep.is_wheelchair_accessible === true);
    }
    return { filtered, hasAirConditioningData, hasAccessibilityData, hasRequestStop };
};

/** Whether an empty board at a metro station is explained by the metro's closed hours `[from, to)`, in the city's zone. */
export const isMetroClosed = (nowMs: number, timeZone: string, metroClosedHours: [number, number] | null): boolean => {
    return !!metroClosedHours && isWithinLocalHours(nowMs, timeZone, metroClosedHours);
};

/** Departures in expected-time order, as a new array. */
export const sortByExpectedTime = (departures: Departure[]): Departure[] =>
    [...departures].sort((a, b) => Date.parse(a.timestamp || a.scheduled) - Date.parse(b.timestamp || b.scheduled));

/** The next `count` departures by expected time, optionally without cancelled ones. */
export const nextDepartures = (departures: Departure[], count: number, excludeCanceled = false): Departure[] =>
    sortByExpectedTime(excludeCanceled ? departures.filter(dep => !dep.isCanceled) : departures).slice(0, count);

/** Departures still catchable after a walk of `walkMins` minutes; all of them without a walk. */
export const catchableDepartures = (departures: Departure[], now: number, walkMins: number): Departure[] =>
    walkMins > 0 ? departures.filter(d => Date.parse(d.timestamp) - now >= walkMins * 60_000) : departures;

/** A pinned line's next departures in its direction. */
export const nextDeparturesOf = (departures: Departure[], line: string, headsign: string, count: number): Departure[] =>
    nextDepartures(departures.filter(dep => dep.line === line && dep.headsign === headsign), count);

/**
 * A multi-stop response split back per stop: by the `stopId` each departure was requested under, or, given
 * `requestOf` (each stop's request id), per stop, several stops asked for under one request sharing its departures.
 */
export const departuresByStop = (departures: Departure[], requestOf?: ReadonlyMap<string, string>): Map<string, Departure[]> => {
    const byStop = new Map<string, Departure[]>();
    for (const dep of departures) {
        if (!dep.stopId) continue;
        const list = byStop.get(dep.stopId);
        if (list) list.push(dep);
        else byStop.set(dep.stopId, [dep]);
    }
    if (!requestOf) return byStop;
    const byOwnId = new Map<string, Departure[]>();
    for (const [id, request] of requestOf) {
        const deps = byStop.get(request);
        if (deps) byOwnId.set(id, deps);
    }
    return byOwnId;
};
