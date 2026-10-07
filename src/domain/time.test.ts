import { describe, expect, it } from 'vitest';
import { formatTimetableClock } from './time';

// Board times follow the city's zone, so they agree with its trips' timetable times on any device.
describe('formatTimetableClock', () => {
    it('shows an instant in the given city zone, across the end of summer time', () => {
        expect(formatTimetableClock('2026-10-07T12:05:00Z', 'Europe/Prague')).toBe('14:05');
        expect(formatTimetableClock('2026-10-25T01:30:00Z', 'Europe/Prague')).toBe('02:30');
        expect(formatTimetableClock('2026-10-07T14:05:00+02:00', 'Europe/Prague')).toBe('14:05');
        expect(formatTimetableClock('2026-10-07T12:05:00Z', 'America/New_York')).toBe('08:05');
    });
});
