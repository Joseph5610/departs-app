import type { CityConfig } from '../../../../_core/city-config';
import type { GtfsRoutesData, GtfsTripRoutesData } from '../../../gtfs/core/gtfs-data';
import { dayBit, operatesOnDay, type TripWindow, type TripWindows } from '../../../gtfs/core/trip-windows';
import { getTripStops } from '../../../gtfs/core/trip-stops';
import { DPMP_CONFIG } from '../../core/config';
import type { DpmpVehicleRow } from '../../core/dpmp-csv-feed';

const DAY_MINS = 1440;

interface Candidate {
    tripId: string;
    window: TripWindow;
}

/** `route|start_mins|direction_id` -> trips sharing that planned start. */
type MatchIndex = Map<string, Candidate[]>;

export interface TripMatch {
    tripId: string;
    /** Planned start in minutes relative to today's local midnight (negative for yesterday's). */
    startRelMins: number;
}

export interface MatchContext {
    todayStr: string;
    yesterdayStr: string;
    nowMins: number;
}

/** Built once per loaded windows file and collected with it. */
const indexes = new WeakMap<TripWindows, MatchIndex>();

const matchKey = (route: string, startMins: number, directionId: number) => `${route}|${startMins}|${directionId}`;

const normalizeStopName = (name: string) =>
    name.replace(/\*/g, '').replace(/\.\s*/g, '.').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Resolves DPMP CSV vehicle rows to GTFS trips.
 *
 * The CSV carries no trip id, only the line, direction and planned start at the first stop.
 * Those identify a trip except for a handful of branch variants starting at the same minute,
 * which are told apart by the name of the stop at the reported stop order.
 */
export class DpmpTripMatcher {
    constructor(
        private readonly city: CityConfig,
        private readonly windows: TripWindows,
        private readonly routes: GtfsRoutesData,
        private readonly tripRoutes: GtfsTripRoutesData
    ) {}

    private getIndex(): MatchIndex {
        const existing = indexes.get(this.windows);
        if (existing) return existing;

        const index: MatchIndex = new Map();
        for (const tripId in this.windows.trips) {
            const window = this.windows.trips[tripId];
            const directionId = window[3];
            const routeId = this.tripRoutes.tripRoutes[tripId];
            const route = routeId ? this.routes.routes[routeId] : undefined;
            if (directionId === undefined || !route) continue;

            const key = matchKey(String(route.name).toUpperCase(), window[0], directionId);
            const bucket = index.get(key);
            if (bucket) bucket.push({ tripId, window });
            else index.set(key, [{ tripId, window }]);
        }

        indexes.set(this.windows, index);
        return index;
    }

    async match(row: DpmpVehicleRow, ctx: MatchContext): Promise<TripMatch | null> {
        const directionId = DPMP_CONFIG.DIRECTION_IDS[row.direction];
        if (directionId === undefined) return null;

        const [h, m] = row.plannedStart.split(':').map(Number);
        const start = h * 60 + m;
        const index = this.getIndex();
        const todayBit = dayBit(this.windows, ctx.todayStr);
        const yesterdayBit = dayBit(this.windows, ctx.yesterdayStr);

        // A clock time can belong to today's service, to yesterday's service past 24:00, or to a
        // trip yesterday's service started before midnight that is still running.
        const options: Array<{ startMins: number; bit: number; relMins: number }> = [
            { startMins: start, bit: todayBit, relMins: start },
            { startMins: start + DAY_MINS, bit: yesterdayBit, relMins: start },
            { startMins: start, bit: yesterdayBit, relMins: start - DAY_MINS },
        ];

        for (const option of options) {
            if (!option.bit) continue;
            const ageMins = ctx.nowMins - option.relMins;
            if (ageMins < -DPMP_CONFIG.MAX_EARLY_START_MINS || ageMins > DPMP_CONFIG.MAX_TRIP_AGE_MINS) continue;

            const candidates: Candidate[] = [];
            for (const c of index.get(matchKey(row.routeNumber, option.startMins, directionId)) ?? []) {
                if (operatesOnDay(c.window, option.bit)) candidates.push(c);
            }
            if (candidates.length === 0) continue;

            const tripId = candidates.length === 1
                ? candidates[0].tripId
                : await this.disambiguate(candidates, row);
            return { tripId, startRelMins: option.relMins };
        }

        return null;
    }

    private async disambiguate(candidates: Candidate[], row: DpmpVehicleRow): Promise<string> {
        const target = normalizeStopName(row.stopName);
        const stopLists = await Promise.all(candidates.map(c => getTripStops(this.city, c.tripId)));
        for (let i = 0; i < candidates.length; i++) {
            const stop = stopLists[i][row.stopOrder - 1];
            if (stop && normalizeStopName(stop.name) === target) return candidates[i].tripId;
        }
        return candidates[0].tripId;
    }
}
