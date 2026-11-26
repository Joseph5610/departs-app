import { dayBit, isWithinMatchWindow, operatesOnDay, type Schedule } from '../../../_feeds/gtfs/schedule';
import { DAY_MINS, type LocalClock } from '../../../_core/utils/time';
import { DUK_CONFIG } from '../../../_feeds/duk/config';
import type { DukVehicleReport } from '../../../_feeds/duk/dukTrafficFeed';

const ANY_DAY = -1;

export interface TripMatch {
    tripId: string;
    /** Added to the trip's own times to place them on today's clock: -1440 for yesterday's trips. */
    offsetMins: number;
}

/** line -> ids of its trips in the hour's schedule, built once per loaded schedule and collected with it. */
const indexes = new WeakMap<Schedule, Map<string, string[]>>();

/** Whether a static trip id's spoj is `number`; a train's spoj joins every number it runs under. */
function hasNumber(tripId: string, number: string): boolean {
    const spoj = tripId.slice(0, tripId.indexOf('-'));
    return spoj === number || (spoj.includes(DUK_CONFIG.TRIP_NUMBER_SEPARATOR) && spoj.split(DUK_CONFIG.TRIP_NUMBER_SEPARATOR).includes(number));
}

/**
 * Resolves Portabo vehicles to static trips by CIS JŘ line and trip number.
 *
 * Static trip ids are `<spoj>-<line>-<timetable>` (departs-data `build-duk.ts`); trains are
 * `<numbers>-rail-<variant>`, matched by train number under the line `rail`. A number can exist in
 * several timetables, but the build lets only one of them run on a given service day, so the
 * candidate operating on the day whose window contains now wins.
 */
export class DukTripMatcher {
    constructor(private readonly schedule: Schedule) {}

    /** Indexed by line alone: a line has few enough trips to scan for a number, and one map is half the build. */
    private tripsOf(lineNumber: string): string[] | undefined {
        let index = indexes.get(this.schedule);
        if (!index) {
            index = new Map();
            for (const tripId in this.schedule.trips) {
                const lineStart = tripId.indexOf('-') + 1;
                const lineEnd = tripId.indexOf('-', lineStart);
                const end = lineEnd === -1 ? tripId.length : lineEnd;
                if (lineStart <= 1 || end <= lineStart) continue;
                const line = tripId.slice(lineStart, end);
                const trips = index.get(line);
                if (trips) trips.push(tripId);
                else index.set(line, [tripId]);
            }
            indexes.set(this.schedule, index);
        }
        return index.get(lineNumber);
    }

    /** The trip a report names: a bus by its CIS line and spoj, a train by its number. */
    matchReport(report: Pick<DukVehicleReport, 'lineNumber' | 'tripNumber' | 'trainNumber'>, ctx: LocalClock): TripMatch | null {
        if (report.lineNumber) return report.tripNumber !== null ? this.match(report.lineNumber, report.tripNumber, ctx) : null;
        return report.trainNumber !== null ? this.match(DUK_CONFIG.TRAIN_TRIP_LINE, report.trainNumber, ctx) : null;
    }

    match(lineNumber: string, tripNumber: number, ctx: LocalClock): TripMatch | null {
        const number = String(tripNumber);
        const candidates = this.tripsOf(lineNumber)?.filter(tripId => hasNumber(tripId, number));
        if (!candidates?.length) return null;

        // Yesterday's trips are shifted back a day, so one still running past midnight is placed correctly.
        // The last option trusts the feed over the timetable calendar: operators do run trips on days
        // their JDF codes exclude, and line, number and time together still identify the trip.
        const options = [
            { bit: dayBit(this.schedule, ctx.date), offsetMins: 0 },
            { bit: dayBit(this.schedule, ctx.previousDate), offsetMins: -DAY_MINS },
            { bit: ANY_DAY, offsetMins: 0 },
            { bit: ANY_DAY, offsetMins: -DAY_MINS },
        ];

        for (const option of options) {
            if (!option.bit) continue;
            for (const tripId of candidates) {
                const window = this.schedule.trips[tripId];
                if (option.bit !== ANY_DAY && !operatesOnDay(window, option.bit)) continue;
                if (isWithinMatchWindow(window, ctx.mins, option.offsetMins)) {
                    return { tripId, offsetMins: option.offsetMins };
                }
            }
        }

        return null;
    }

    /** The line's trips the timetable runs today (or yesterday past midnight) within `marginMins` of now. */
    runningNow(lineNumber: string, ctx: LocalClock, marginMins: number): TripMatch[] {
        const out: TripMatch[] = [];
        const days = [
            { bit: dayBit(this.schedule, ctx.date), offsetMins: 0 },
            { bit: dayBit(this.schedule, ctx.previousDate), offsetMins: -DAY_MINS },
        ];
        for (const tripId of this.tripsOf(lineNumber) ?? []) {
            const window = this.schedule.trips[tripId];
            for (const day of days) {
                if (!day.bit || !operatesOnDay(window, day.bit)) continue;
                if (ctx.mins >= window[0] + day.offsetMins - marginMins && ctx.mins <= window[1] + day.offsetMins + marginMins) {
                    out.push({ tripId, offsetMins: day.offsetMins });
                }
            }
        }
        return out;
    }
}
