import { describe, expect, it } from 'vitest';
import { stopTime } from '@/test/factories';
import { firstTransferSequence, nextStopSequence, stopDisplayTimes } from './timeline';
import { isTripEnded } from './tripEnd';
import { vehicleNotice } from './status';

const connection = { trip_id: 't9', line: '9', type: 'tram' as const, headsign: 'Spojovací', departure_time: '14:12:00', delay: null, max_wait_s: 120, at_risk: false };

describe('timeline positions', () => {
    const stops = [stopTime(1, '14:00:00'), stopTime(2, '14:05:00'), stopTime(3, '14:10:00', { connections: [connection] }), stopTime(5, '14:20:00')];

    it('finds the next stop by sequence, skipping gaps in the numbering', () => {
        expect(nextStopSequence(stops, 3)).toBe(5);
        expect(nextStopSequence(stops, 5)).toBeNull();
        expect(nextStopSequence(stops, null)).toBeNull();
    });

    it('finds the first stop with transfers from the current one on', () => {
        expect(firstTransferSequence(stops, 2)).toBe(3);
        expect(firstTransferSequence(stops, 4)).toBeNull();
    });
});

describe('stopDisplayTimes', () => {
    // KORDIS trains lay over at the terminus for hours; its departure time is the next run, not this trip.
    it('shows the terminus arrival even once the vehicle is there', () => {
        const terminus = stopTime(9, '14:30:00', { departure_time: '17:10:00' });

        expect(stopDisplayTimes(terminus, false, true, true, 0).scheduledTime).toBe('14:30:00');
        expect(stopDisplayTimes(terminus, false, true, false, 0).scheduledTime).toBe('17:10:00');
    });

    it('projects the live delay onto upcoming stops but keeps the recorded time of past ones', () => {
        const stop = stopTime(4, '14:15:00', { realtime_arrival_time: '14:16:00' });

        expect(stopDisplayTimes(stop, false, false, false, 120)).toMatchObject({ realtimeTime: '14:17:00', hasRealtime: true });
        expect(stopDisplayTimes(stop, true, false, false, 120)).toMatchObject({ realtimeTime: '14:16:00', hasRealtime: true });
    });
});

describe('vehicleNotice', () => {
    it('warns in order of severity: cancelled, then timetable-only, then the vehicle state', () => {
        expect(vehicleNotice('canceled', true, false)).toBe('canceled');
        expect(vehicleNotice('off_track', true, false)).toBe('staticFallback');
        expect(vehicleNotice('before_track_delayed', false, false)).toBe('beforeTrackDelayed');
        expect(vehicleNotice('before_track', false, false)).toBe('previousTrip');
        expect(vehicleNotice('on_track', false, false)).toBeNull();
    });

    it('stops warning about a timetable-only trip once it has ended', () => {
        expect(vehicleNotice('on_track', true, true)).toBeNull();
    });
});

// Brno, Prešov and DÚK send a last stop past midnight already on the clock (`00:20`, not `24:20`).
describe('isTripEnded across midnight', () => {
    const TZ = 'Europe/Prague';
    const at = (prague: string) => Date.parse(`2026-10-07T${prague}:00+02:00`);
    const endingAt = (time: string) => [stopTime(1, '23:00:00'), stopTime(2, time, { realtime_arrival_time: time })];

    it('keeps a trip ending just after midnight running before midnight', () => {
        expect(isTripEnded(endingAt('00:20:00'), 0, null, at('23:30'), TZ)).toBe(false);
    });

    it('ends a trip that finished just before midnight once the clock is past it', () => {
        expect(isTripEnded(endingAt('23:50:00'), 0, null, Date.parse('2026-10-08T00:10:00+02:00'), TZ)).toBe(true);
    });

    it('reads a service-day time past 24:00 as after midnight', () => {
        expect(isTripEnded(endingAt('24:30:00'), 0, null, Date.parse('2026-10-08T00:10:00+02:00'), TZ)).toBe(false);
    });
});
