import { describe, expect, it } from 'vitest';
import { addSecondsToTime, formatTime, getLocalClock, toClockTime, wrapDaySeconds, zonedLocalToEpochMs } from './time';

const HOUR_MS = 3_600_000;

const intlTime = (atMs: number, timeZone: string) =>
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(atMs));

// The backend hand-rolls EU summer time to avoid Intl's cold-start CPU; Intl is the reference it must match.
describe('EU central time without Intl', () => {
    it.each(['Europe/Prague', 'Europe/Bratislava'])('matches Intl every hour of 2026 and 2027 in %s', (zone) => {
        const mismatches: string[] = [];
        for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += HOUR_MS) {
            if (formatTime(new Date(t), zone) !== intlTime(t, zone)) mismatches.push(new Date(t).toISOString());
        }
        expect(mismatches).toEqual([]);
    });

    // 2026-10-25 01:00 UTC: 03:00 CEST becomes 02:00 CET.
    it('switches back to winter time on the last Sunday of October', () => {
        expect(formatTime(new Date('2026-10-25T00:59:00Z'), 'Europe/Prague')).toBe('02:59');
        expect(formatTime(new Date('2026-10-25T01:00:00Z'), 'Europe/Prague')).toBe('02:00');
    });
});

describe('getLocalClock', () => {
    // GTFS service days are local; just after local midnight the UTC date is still the previous day.
    it('reports the local service day and the one before across a month boundary', () => {
        const clock = getLocalClock('Europe/Prague', Date.parse('2026-10-31T23:30:00Z'));

        expect(clock).toMatchObject({ date: '20261101', previousDate: '20261031', secs: 30 * 60 });
    });
});

describe('zonedLocalToEpochMs', () => {
    it('resolves local wall-clock times on both sides of a DST change', () => {
        expect(zonedLocalToEpochMs('2026-10-24 12:00:00', 'Europe/Prague')).toBe(Date.parse('2026-10-24T10:00:00Z'));
        expect(zonedLocalToEpochMs('2026-10-26 12:00', 'Europe/Prague')).toBe(Date.parse('2026-10-26T11:00:00Z'));
    });

    it('rejects an unparseable timestamp', () => {
        expect(zonedLocalToEpochMs('26.10.2026 12:00', 'Europe/Prague')).toBeNull();
    });
});

// GTFS times run past 24:00 for trips after midnight; the board shows them on the clock.
describe('GTFS time of day', () => {
    it('wraps past-midnight hours and delays onto the clock', () => {
        expect(toClockTime('25:10:00')).toBe('01:10:00');
        expect(addSecondsToTime('23:58:30', 120)).toBe('00:00:30');
        expect(addSecondsToTime('00:00:30', -60)).toBe('23:59:30');
    });

    it('compares times either side of midnight as close together', () => {
        expect(wrapDaySeconds(23 * 3600)).toBe(-3600);
        expect(wrapDaySeconds(-23 * 3600)).toBe(3600);
    });
});
