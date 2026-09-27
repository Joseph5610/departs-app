/**
 * Trip id -> trip id as departs-data writes it (`trip_alias_runs.json`): consecutive numeric ids that
 * map to consecutive ids collapse into one run, so a fresh isolate parses a few thousand numbers
 * instead of a record of tens of thousands of keys.
 */
export interface TripRunsFile {
    /** Flat `[firstTripId, firstValue, count, ...]`, sorted by `firstTripId`. */
    runs: number[];
    /** Trips whose ids or values are not canonical integers, including null values. */
    other?: Record<string, string | null>;
}

export class TripRuns {
    constructor(private readonly file: TripRunsFile) {}

    /** The trip's value; null where the table maps it to null, undefined where it has no entry. */
    get(tripId: string): string | null | undefined {
        const { runs, other } = this.file;
        const listed = other?.[tripId];
        if (listed !== undefined) return listed;

        const id = Number(tripId);
        if (!Number.isInteger(id) || String(id) !== tripId) return undefined;

        let lo = 0;
        let hi = runs.length / 3 - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const first = runs[mid * 3];
            if (id < first) hi = mid - 1;
            else if (id >= first + runs[mid * 3 + 2]) lo = mid + 1;
            else return String(runs[mid * 3 + 1] + id - first);
        }
        return undefined;
    }
}

export const EMPTY_TRIP_RUNS = new TripRuns({ runs: [] });
