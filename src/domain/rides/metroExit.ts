import type { MetroExitsFile, StopTimeFeature } from '@/types';

/** Consecutive cars `[first, last]`, car 1 at the front of the train. */
export type CarSpan = [number, number];

export interface MetroExitAdvice {
    /** Each way out with the cars nearest to it, front of the train first. */
    exits: { name: string; sign: string | null; cars: CarSpan[] }[];
    /** The way out avoiding stairs and escalators; null when it is one of `exits` with the same cars. */
    stepFree: { name: string; cars: CarSpan[] } | null;
}

/** Groups car numbers into runs: `[1, 2, 3, 5]` -> `[[1, 3], [5, 5]]`. */
export const carSpans = (cars: readonly number[]): CarSpan[] => {
    const spans: CarSpan[] = [];
    for (const car of [...new Set(cars)].sort((a, b) => a - b)) {
        const last = spans[spans.length - 1];
        if (last && car === last[1] + 1) last[1] = car;
        else spans.push([car, car]);
    }
    return spans;
};

const sameCars = (a: readonly number[], b: readonly number[]): boolean => {
    const set = new Set(a);
    return set.size === new Set(b).size && b.every(car => set.has(car));
};

/** Which car to ride for the way out at a trip's exit stop, from its platform's entry in `metro_exits.json`; null where the file has none. */
export const metroExitAdvice = (file: MetroExitsFile | undefined, stops: readonly Pick<StopTimeFeature, 'properties'>[] | undefined, exitSequence: number | null): MetroExitAdvice | null => {
    if (!file || !stops || exitSequence === null) return null;
    const stop = stops.find(s => Number(s.properties.stop_sequence) === exitSequence);
    const platform = stop ? file[stop.properties.stop_id] : undefined;
    if (!platform || platform.exits.length === 0) return null;

    const exits = platform.exits
        .map(([name, sign, cars]) => ({ name, sign, cars: carSpans(cars) }))
        .sort((a, b) => (a.cars[0]?.[0] ?? 0) - (b.cars[0]?.[0] ?? 0));
    const free = platform.stepFree;
    const isCovered = free && platform.exits.some(([name, , cars]) => name === free[0] && sameCars(cars, free[1]));
    return { exits, stepFree: free && !isCovered ? { name: free[0], cars: carSpans(free[1]) } : null };
};
