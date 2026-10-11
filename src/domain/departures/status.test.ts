import { describe, expect, it } from 'vitest';
import { departure, feeder } from '@/test/factories';
import { DELAY_BADGE_TOLERANCE_S } from '@/config/transit';
import { boardingPlace, departureClock, feederNotice, liveStatus } from './index';

// The board's status dot: no realtime reads as timetable, small deviations as on time.
describe('liveStatus', () => {
    it('reads cancellation first, then missing realtime, then the delay against the tolerance', () => {
        expect(liveStatus(departure({ isCanceled: true, delay: 300 }))).toBe('canceled');
        expect(liveStatus(departure({ delay: null }))).toBe('timetable');
        expect(liveStatus(departure({ delay: 0 }))).toBe('onTime');
        expect(liveStatus(departure({ delay: DELAY_BADGE_TOLERANCE_S }))).toBe('onTime');
        expect(liveStatus(departure({ delay: DELAY_BADGE_TOLERANCE_S + 1 }))).toBe('late');
        expect(liveStatus(departure({ delay: -DELAY_BADGE_TOLERANCE_S - 1 }))).toBe('early');
    });
});

// A missed connection outranks a hold, which outranks the planned wait.
describe('feederNotice', () => {
    it('reports a missed feeder, else a live hold, else the lines it waits for', () => {
        const c = (name: string) => ({ name, color: '#7A0603' });
        expect(feederNotice([feeder({ line: '22', hold_s: 150, route_color: '#7A0603' }), feeder({ line: '3', will_miss: true, route_color: '#7A0603' })])).toEqual({ kind: 'wontWait', lines: [c('3')] });
        expect(feederNotice([feeder({ line: '22', hold_s: 150, route_color: '#7A0603' })])).toEqual({ kind: 'held', lines: [c('22')], minutes: 3 });
        expect(feederNotice([feeder({ line: '22', hold_s: null, route_color: '#7A0603' }), feeder({ line: '9', hold_s: null, route_color: '#7A0603' })])).toEqual({ kind: 'waits', lines: [c('9'), c('22')] });
        expect(feederNotice(undefined)).toBeNull();
        expect(feederNotice([])).toBeNull();
    });
});

// A live departure shows its expected time next to the struck timetable time, only when the minute changes.
describe('departureClock', () => {
    const tz = 'Europe/Prague';
    it('adds the expected time only for live departures moved to another minute', () => {
        expect(departureClock({ scheduled: '2026-10-09T11:43:00Z', timestamp: '2026-10-09T11:45:13Z', delay: 133, isCanceled: false }, tz))
            .toEqual({ scheduled: '13:43', expected: '13:45' });
        expect(departureClock({ scheduled: '2026-10-09T11:43:00Z', timestamp: '2026-10-09T11:43:17Z', delay: 17, isCanceled: false }, tz))
            .toEqual({ scheduled: '13:43', expected: null });
        expect(departureClock({ scheduled: '2026-10-09T11:43:00Z', timestamp: '2026-10-09T11:42:15Z', delay: -45, isCanceled: false }, tz))
            .toEqual({ scheduled: '13:43', expected: '13:42' });
        expect(departureClock({ scheduled: '2026-10-09T11:43:00Z', timestamp: '2026-10-09T11:43:00Z', delay: null, isCanceled: false }, tz))
            .toEqual({ scheduled: '13:43', expected: null });
        expect(departureClock({ scheduled: '2026-10-09T11:43:00Z', timestamp: '2026-10-09T11:50:00Z', delay: 420, isCanceled: true }, tz))
            .toEqual({ scheduled: '13:43', expected: null });
    });
});

// Metro tracks and train platforms are shown; a bus or tram stop's platform code is the stop itself.
describe('boardingPlace', () => {
    it('reads a metro platform as its track and a train platform as its platform, others as neither', () => {
        expect(boardingPlace(departure({ type: 'metro', platform: '1' }))).toEqual({ track: '1', platform: null });
        expect(boardingPlace(departure({ type: 'train', platform: '3' }))).toEqual({ track: null, platform: '3' });
        expect(boardingPlace(departure({ type: 'tram', platform: 'A' }))).toEqual({ track: null, platform: null });
        expect(boardingPlace(departure({ type: 'train' }))).toEqual({ track: null, platform: null });
    });
});
