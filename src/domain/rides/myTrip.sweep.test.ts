import { describe, expect, it } from 'vitest';
import type { MyTrip, MyTripStatus, VehicleDetail } from '@/types';
import { MIN, stopTime, vehicleDetail } from '@/test/factories';
import { timetableInstantMs } from './boarding';
import { deriveMyTrip } from './myTrip';

const TZ = 'Europe/Prague';
const DWELL_MS = 30_000;

/** A trip's calls: the timetable time as the feed gives it, and the instant it means in Prague. */
interface Scenario {
    name: string;
    stops: { local: string; utc: string }[];
}

// Boarding at stop 2 with a 5 min alert, getting off at stop 4; each runs across something the clock can get wrong.
const SCENARIOS: Scenario[] = [
    { name: 'a summer afternoon', stops: [['14:00', '12:00'], ['14:10', '12:10'], ['14:20', '12:20'], ['14:30', '12:30'], ['14:40', '12:40']].map(([local, utc]) => ({ local: `${local}:00`, utc: `2026-07-15T${utc}:00Z` })) },
    {
        name: 'midnight',
        stops: [['23:40', '2026-11-10T22:40'], ['23:50', '2026-11-10T22:50'], ['00:00', '2026-11-10T23:00'], ['00:10', '2026-11-10T23:10'], ['00:20', '2026-11-10T23:20']]
            .map(([local, utc]) => ({ local: `${local}:00`, utc: `${utc}:00Z` })),
    },
    {
        name: 'the spring DST switch',
        stops: [['01:40', '00:40'], ['01:50', '00:50'], ['03:10', '01:10'], ['03:20', '01:20'], ['03:30', '01:30']].map(([local, utc]) => ({ local: `${local}:00`, utc: `2026-03-29T${utc}:00Z` })),
    },
    {
        name: 'the autumn DST switch',
        stops: [['01:40', '2026-10-24T23:40'], ['01:50', '2026-10-24T23:50'], ['03:10', '2026-10-25T02:10'], ['03:20', '2026-10-25T02:20'], ['03:30', '2026-10-25T02:30']]
            .map(([local, utc]) => ({ local: `${local}:00`, utc: `${utc}:00Z` })),
    },
];

const BOARD = 2;
const EXIT = 4;

/** What the vehicle-detail API answers at `now` for a vehicle running on time. */
const detailAt = (scenario: Scenario, now: number): VehicleDetail => {
    const times = scenario.stops.map(stop => Date.parse(stop.utc));
    const passed = times.filter(at => at <= now).length;
    const atStop = passed > 0 && (now - times[passed - 1] < DWELL_MS || passed === times.length);
    return vehicleDetail({
        delay: 0,
        state_position: passed === 0 ? 'before_track' : atStop ? 'at_stop' : 'on_track',
        last_stop_sequence: passed === 0 ? null : passed,
        stop_times: { type: 'FeatureCollection', features: scenario.stops.map((stop, i) => stopTime(i + 1, stop.local)) },
    });
};

/** The trip as the sheet saves it `savedAt`: its boarding stop's timetable time read in the city's zone. */
const savedTrip = (scenario: Scenario, savedAt: number, withBoard: boolean): MyTrip => ({
    city: 'prague', tripId: 'trip-1', vehicleId: 'veh-trip-1', exitSequence: EXIT, exitStopName: 'Stop 4', startedAt: savedAt, toEnd: false,
    board: withBoard
        ? { sequence: BOARD, stopId: 's2', stopName: 'Stop 2', scheduledMs: timetableInstantMs(scenario.stops[BOARD - 1].local, savedAt, TZ), leadMin: 5 }
        : null,
});

/** The trip's state every minute (and every 15 s near its stops) from `from` until `until`. */
const sweep = (scenario: Scenario, trip: MyTrip, from: number, until: number) => {
    const states: { now: number; status: MyTripStatus | null }[] = [];
    for (let now = from; now <= until; now += 15_000) states.push({ now, status: deriveMyTrip(trip, detailAt(scenario, now), false, now, TZ) });
    return states;
};

describe.each(SCENARIOS)('a trip across $name', scenario => {
    const at = (sequence: number) => Date.parse(scenario.stops[sequence - 1].utc);
    const savedAt = at(1) - 60 * MIN;

    // I7: the saved boarding time is the instant the timetable means in Prague, across midnight and DST.
    it('saves each stop at the instant its timetable time means', () => {
        expect(savedTrip(scenario, savedAt, true).board?.scheduledMs).toBe(at(BOARD));
        expect(scenario.stops.map(stop => timetableInstantMs(stop.local, savedAt, TZ))).toEqual(scenario.stops.map(stop => Date.parse(stop.utc)));
    });

    // I5: the trip lives until its exit, counts down to boarding, then rides to the exit.
    it('counts down to boarding, rides, and arrives, never dropped on the way', () => {
        const states = sweep(scenario, savedTrip(scenario, savedAt, true), savedAt, at(EXIT) + MIN);
        let lastMinutes = Number.POSITIVE_INFINITY;
        for (const { now, status } of states) {
            const when = new Date(now).toISOString();
            expect(status, when).not.toBeNull();
            if (now < at(BOARD)) {
                expect(status, when).toMatchObject({ phase: 'boarding', departureTime: scenario.stops[BOARD - 1].local.slice(0, 5) });
                if (status?.phase === 'boarding') {
                    expect(status.minutes, when).toBeLessThanOrEqual(lastMinutes);
                    lastMinutes = status.minutes;
                    expect(status.isSoon, when).toBe(status.minutes <= 5);
                }
            } else if (now >= at(BOARD) + 3 * MIN && now < at(EXIT)) {
                expect(status?.phase, when).toBe('riding');
                if (status?.phase === 'riding') expect(['riding', 'next'], when).toContain(status.ride.phase);
            } else if (now >= at(EXIT)) {
                expect(status?.phase === 'riding' && status.ride.phase, when).toBe('arrived');
            }
        }
        expect(states.some(({ status }) => status?.phase === 'riding' && status.ride.phase === 'next')).toBe(true);
    });

    // I5, I7: a trip saved many hours ahead (tomorrow's first bus) must count down to that departure, not one a day off.
    it.each([11, 13, 20])('counts down to boarding from a trip saved %i hours ahead', hours => {
        const early = at(1) - hours * 60 * MIN;
        const trip = savedTrip(scenario, early, true);
        expect(trip.board?.scheduledMs).toBe(at(BOARD));
        for (const { now, status } of sweep(scenario, trip, early, at(BOARD) - MIN)) {
            expect(status, new Date(now).toISOString()).toMatchObject({ phase: 'boarding', departureTime: scenario.stops[BOARD - 1].local.slice(0, 5) });
        }
    });

    it('rides a trip taken already aboard to its exit', () => {
        const boardedAt = at(1) + 2 * MIN;
        const states = sweep(scenario, savedTrip(scenario, boardedAt, false), boardedAt, at(EXIT) - 15_000);
        for (const { now, status } of states) expect(status?.phase === 'riding' && status.ride.phase, new Date(now).toISOString()).toMatch(/^(riding|next)$/);
    });
});
