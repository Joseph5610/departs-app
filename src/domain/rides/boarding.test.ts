import { describe, expect, it } from 'vitest';
import type { StopTimeFeature } from '@/types';
import { boardingAt, boardingSequence, boardingChoices, stopDepartureClock, defaultLead, fittingLeads, reminderCountdown, timetableInstantMs, walkLeadMinutes } from './boarding';

const TZ = 'Europe/Prague';
// 2026-10-20 12:00:00 in Prague (CEST, UTC+2).
const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);
const MIN = 60_000;

const stop = (departure_time: string, stop_sequence = 3, stop_id = `s${stop_sequence}`) => ({ properties: { stop_sequence, stop_id, stop_name: 'Stop', departure_time } }) as unknown as StopTimeFeature;

describe('timetableInstantMs', () => {
    it('reads the time in the city zone', () => {
        expect(timetableInstantMs('12:20:00', NOW, TZ)).toBe(NOW + 20 * MIN);
    });

    // I5: a boarding stop can be far ahead (tomorrow's first bus), but hardly hours behind.
    it('reads a time up to three hours behind as today, and one further behind as tomorrow', () => {
        expect(timetableInstantMs('09:30:00', NOW, TZ)).toBe(NOW - 150 * MIN);
        expect(timetableInstantMs('08:30:00', NOW, TZ)).toBe(NOW + (20 * 60 + 30) * MIN);
        expect(timetableInstantMs('05:10:00', NOW + 4.5 * 60 * MIN, TZ)).toBe(NOW + (17 * 60 + 10) * MIN);
    });

    // A service-day time past 24:00 is the same night's early morning.
    it('places times past midnight on the right day', () => {
        const lateEvening = Date.UTC(2026, 9, 20, 21, 50, 0);
        expect(timetableInstantMs('24:10:00', lateEvening, TZ)).toBe(lateEvening + 20 * MIN);
        expect(timetableInstantMs('00:10:00', lateEvening, TZ)).toBe(lateEvening + 20 * MIN);
    });
});

describe('fittingLeads', () => {
    it('offers the leads that still fit, counting the delay', () => {
        expect(fittingLeads(NOW + 7 * MIN, null, NOW)).toEqual([2, 5]);
        expect(fittingLeads(NOW + 7 * MIN, 300, NOW)).toEqual([2, 5, 10]);
    });
});

describe('boardingSequence', () => {
    it('finds the first call at the board stop still ahead of the vehicle', () => {
        const stops = [stop('12:10:00', 1, 'a'), stop('12:15:00', 2, 'b'), stop('12:20:00', 3, 'a')];
        expect(boardingSequence(stops, new Set(['a']), 1)).toBe(3);
        expect(boardingSequence(stops, new Set(['x']), null)).toBeNull();
    });
});

describe('walkLeadMinutes', () => {
    // Walking time plus the time to find the platform, so the user arrives before the vehicle.
    it('adds the catch buffer to the walk, and offers nothing at the stop', () => {
        expect(walkLeadMinutes({ distance: 400, time: 7, isAtStop: false, isReasonableWalkingDistance: true })).toBe(9);
        expect(walkLeadMinutes({ distance: 10, time: 1, isAtStop: true, isReasonableWalkingDistance: true })).toBeNull();
        expect(walkLeadMinutes(null)).toBeNull();
    });

    it('caps a long walk at the longest lead the server accepts', () => {
        expect(walkLeadMinutes({ distance: 6000, time: 100, isAtStop: false, isReasonableWalkingDistance: false })).toBe(60);
    });
});

describe('reminderCountdown', () => {
    it('counts to the delayed departure', () => {
        expect(reminderCountdown(NOW + 10 * MIN, 120, NOW)).toEqual({ expectedMs: NOW + 12 * MIN, minutes: 12 });
        expect(reminderCountdown(NOW - 5 * MIN, null, NOW).minutes).toBe(0);
    });
});

describe('boardingChoices', () => {
    // A stop the trip leaves within the shortest lead (plus a minute) can still be boarded at, without an alert.
    it('lists the stops ahead with the leads still possible there', () => {
        const stops = [stop('12:01:00', 1), stop('12:02:00', 2), stop('12:10:00', 3), stop('12:20:00', 4)];
        const choices = boardingChoices(stops, 1, null, NOW, TZ);
        expect(choices.map(c => [c.sequence, c.time, c.leads])).toEqual([[2, '12:02', []], [3, '12:10', [2, 5]], [4, '12:20', [2, 5, 10, 15]]]);
    });
});

describe('defaultLead', () => {
    it('prefers the walk, then the default, then the longest lead left', () => {
        expect(defaultLead([2, 5, 10], 8)).toBe(8);
        expect(defaultLead([2, 5, 10], null)).toBe(5);
        expect(defaultLead([2], null)).toBe(2);
        expect(defaultLead([], null)).toBeNull();
    });
});

describe('boardingAt and stopDepartureClock', () => {
    // A shared link names the sharer's boarding stop by its sequence.
    it('reads a stop of the trip as a boarding stop without an alert, and its expected departure', () => {
        const stops = [stop('12:10:00', 1, 'a'), stop('12:20:00', 2, 'b')];
        expect(boardingAt(stops, 2, NOW, TZ)).toEqual({ sequence: 2, stopId: 'b', stopName: 'Stop', scheduledMs: NOW + 20 * MIN, leadMin: null });
        expect(boardingAt(stops, 9, NOW, TZ)).toBeNull();
        expect(stopDepartureClock(stops, 2, 120)).toBe('12:22');
    });
});
