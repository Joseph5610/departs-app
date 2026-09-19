import { dayBit, operatesOnDay, type TripWindow, type TripWindows } from '../../../gtfs/core/trip-windows';
import { DUK_CONFIG } from '../../core/config';
import { DAY_MINS, type LocalClock } from '../../../../_core/utils/time';

const ANY_DAY = -1;

interface Candidate {
    tripId: string;
    window: TripWindow;
}

interface MatchIndex {
    /** `line|spoj` -> static trips carrying that CIS JŘ trip number. */
    byNumber: Map<string, Candidate[]>;
    /** line -> all its static trips. */
    byLine: Map<string, Candidate[]>;
}

export interface TripMatch {
    tripId: string;
    /** Added to the trip's own times to place them on today's clock: -1440 for yesterday's trips. */
    offsetMins: number;
}

/** Built once per loaded windows file and collected with it. */
const indexes = new WeakMap<TripWindows, MatchIndex>();

const matchKey = (lineNumber: string, tripNumber: number | string) => `${lineNumber}|${tripNumber}`;

/**
 * Resolves Portabo vehicles to static trips by CIS JŘ line and trip number.
 *
 * Static trip ids are `<spoj>-<line>-<timetable>` (departs-data `build-duk.mjs`). A number can
 * exist in several timetables, but the build lets only one of them run on a given service day, so
 * the candidate operating on the day whose window contains now wins.
 */
export class DukTripMatcher {
    constructor(private readonly windows: TripWindows) {}

    private getIndex(): MatchIndex {
        const existing = indexes.get(this.windows);
        if (existing) return existing;

        const index: MatchIndex = { byNumber: new Map(), byLine: new Map() };
        const add = (map: Map<string, Candidate[]>, key: string, candidate: Candidate) => {
            const bucket = map.get(key);
            if (bucket) bucket.push(candidate);
            else map.set(key, [candidate]);
        };
        for (const tripId in this.windows.trips) {
            const [tripNumber, lineNumber] = tripId.split('-');
            if (!tripNumber || !lineNumber) continue;
            const candidate = { tripId, window: this.windows.trips[tripId] };
            add(index.byNumber, matchKey(lineNumber, tripNumber), candidate);
            add(index.byLine, lineNumber, candidate);
        }

        indexes.set(this.windows, index);
        return index;
    }

    match(lineNumber: string, tripNumber: number, ctx: LocalClock): TripMatch | null {
        const candidates = this.getIndex().byNumber.get(matchKey(lineNumber, tripNumber));
        if (!candidates) return null;

        // Yesterday's trips are shifted back a day, so one still running past midnight is placed correctly.
        // The last option trusts the feed over the timetable calendar: operators do run trips on days
        // their JDF codes exclude, and line, number and time together still identify the trip.
        const options = [
            { bit: dayBit(this.windows, ctx.date), offsetMins: 0 },
            { bit: dayBit(this.windows, ctx.previousDate), offsetMins: -DAY_MINS },
            { bit: ANY_DAY, offsetMins: 0 },
            { bit: ANY_DAY, offsetMins: -DAY_MINS },
        ];

        for (const option of options) {
            if (!option.bit) continue;
            for (const c of candidates) {
                if (option.bit !== ANY_DAY && !operatesOnDay(c.window, option.bit)) continue;
                const start = c.window[0] + option.offsetMins;
                const end = c.window[1] + option.offsetMins;
                if (ctx.mins >= start - DUK_CONFIG.MAX_EARLY_START_MINS && ctx.mins <= end + DUK_CONFIG.MAX_LATE_END_MINS) {
                    return { tripId: c.tripId, offsetMins: option.offsetMins };
                }
            }
        }

        return null;
    }

    /** The line's trips the timetable runs today (or yesterday past midnight) within `marginMins` of now. */
    runningNow(lineNumber: string, ctx: LocalClock, marginMins: number): TripMatch[] {
        const out: TripMatch[] = [];
        const days = [
            { bit: dayBit(this.windows, ctx.date), offsetMins: 0 },
            { bit: dayBit(this.windows, ctx.previousDate), offsetMins: -DAY_MINS },
        ];
        for (const c of this.getIndex().byLine.get(lineNumber) ?? []) {
            for (const day of days) {
                if (!day.bit || !operatesOnDay(c.window, day.bit)) continue;
                if (ctx.mins >= c.window[0] + day.offsetMins - marginMins && ctx.mins <= c.window[1] + day.offsetMins + marginMins) {
                    out.push({ tripId: c.tripId, offsetMins: day.offsetMins });
                }
            }
        }
        return out;
    }
}
