import { describe, expect, it } from 'vitest';
import { formatTimetableClock, minutesCountdown } from './time';

// Board times follow the city's zone, so they agree with its trips' timetable times on any device.
describe('formatTimetableClock', () => {
    it('shows an instant in the given city zone, across the end of summer time', () => {
        expect(formatTimetableClock('2026-10-07T12:05:00Z', 'Europe/Prague')).toBe('14:05');
        expect(formatTimetableClock('2026-10-25T01:30:00Z', 'Europe/Prague')).toBe('02:30');
        expect(formatTimetableClock('2026-10-07T14:05:00+02:00', 'Europe/Prague')).toBe('14:05');
        expect(formatTimetableClock('2026-10-07T12:05:00Z', 'America/New_York')).toBe('08:05');
    });
});

describe('minutesCountdown', () => {
    const now = Date.parse('2026-10-09T12:00:00Z');
    const at = (seconds: number) => new Date(now + seconds * 1000).toISOString();

    // Glanceable countdowns never look like clock times: minutes below the limit, the clock time after.
    it('reads due departures as now, the next hour in whole minutes, later ones by the clock', () => {
        expect(minutesCountdown(at(-30), now, 60)).toEqual({ kind: 'now' });
        expect(minutesCountdown(at(59), now, 60)).toEqual({ kind: 'now' });
        expect(minutesCountdown(at(60), now, 60)).toEqual({ kind: 'minutes', minutes: 1 });
        expect(minutesCountdown(at(59 * 60 + 59), now, 60)).toEqual({ kind: 'minutes', minutes: 59 });
        expect(minutesCountdown(at(60 * 60), now, 60)).toEqual({ kind: 'clock' });
    });
});
