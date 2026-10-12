import { describe, expect, it } from 'vitest';
import { openingStatus } from './openingHours';

const H = 3600;
const weekdays = (hours: string) => [{ from: 0, to: 4, hours }];

describe('openingStatus', () => {
    it('reports nonstop when every day runs 0:00-24:00', () => {
        expect(openingStatus([{ from: 0, to: 6, hours: '0:00-24:00' }], 3, 12 * H)).toEqual({ kind: 'nonstop' });
    });

    it('is open inside an interval and names its closing time', () => {
        expect(openingStatus(weekdays('6:00-12:45,13:15-20:00'), 1, 14 * H)).toEqual({ kind: 'open', closesAt: '20:00', closingSoon: false });
    });

    it('warns within the closing-soon window', () => {
        expect(openingStatus(weekdays('8:00-16:00'), 0, 15.75 * H)).toMatchObject({ kind: 'open', closingSoon: true });
    });

    it('is closed over a lunch break until the next interval today', () => {
        expect(openingStatus(weekdays('6:00-12:45,13:15-20:00'), 2, 13 * H)).toEqual({ kind: 'closed', opensAt: '13:15', inDays: 0 });
    });

    it('opens on the next covered day after a weekday-only office closes on Friday', () => {
        expect(openingStatus(weekdays('06:25-17:40'), 4, 18 * H)).toEqual({ kind: 'closed', opensAt: '6:25', inDays: 3 });
    });

    it('gives no status for free-text hours', () => {
        expect(openingStatus(weekdays('05:05-22:15 (Lítačka 08:00-17:00)'), 0, 12 * H)).toBeNull();
    });
});
