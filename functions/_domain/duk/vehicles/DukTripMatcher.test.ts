import { describe, expect, it } from 'vitest';
import type { Schedule } from '../../../_feeds/gtfs/schedule';
import type { LocalClock } from '../../../_core/utils/time';
import { DukTripMatcher } from './DukTripMatcher';

const TODAY = '20261126';
const clock = (mins: number): LocalClock => ({ date: TODAY, previousDate: '20261125', secs: mins * 60, mins });

const schedule: Schedule = {
    days: ['20261125', TODAY],
    routes: ['592452', 'U1'],
    trips: {
        '12-592452-1': [600, 640, 0b10, 0],
        '120-592452-1': [610, 650, 0b10, 0],
        '6414-rail-1': [600, 700, 0b10, 1],
        '6414-rail-2': [1000, 1100, 0b10, 1],
        '6415_16415-rail-1': [600, 700, 0b10, 1],
    },
};
const matcher = new DukTripMatcher(schedule);
const bus = (tripNumber: number) => ({ lineNumber: '592452', tripNumber, trainNumber: null });
const train = (trainNumber: number) => ({ lineNumber: null, tripNumber: null, trainNumber });

describe('DukTripMatcher.matchReport', () => {
    it('matches a bus by its line and whole spoj number', () => {
        expect(matcher.matchReport(bus(12), clock(620))?.tripId).toBe('12-592452-1');
    });

    it('matches a train by its number, to the run under way', () => {
        expect(matcher.matchReport(train(6414), clock(620))?.tripId).toBe('6414-rail-1');
        expect(matcher.matchReport(train(6414), clock(1020))?.tripId).toBe('6414-rail-2');
    });

    // A train changes number on its way; the feed may report either.
    it('matches a train under any of the numbers it runs as', () => {
        expect(matcher.matchReport(train(16415), clock(620))?.tripId).toBe('6415_16415-rail-1');
        expect(matcher.matchReport(train(6415), clock(620))?.tripId).toBe('6415_16415-rail-1');
    });

    it('matches no train by part of its number', () => {
        expect(matcher.matchReport(train(641), clock(620))).toBeNull();
    });
});
