import { describe, expect, it } from 'vitest';
import type { AppDeparture } from '../../_core/types';
import { capPerLine } from './perLine';

const dep = (minute: number, line: string, extra: Partial<AppDeparture> = {}): AppDeparture => ({
    timestamp: `2026-10-24T12:${String(minute).padStart(2, '0')}:00Z`,
    scheduled: `2026-10-24T12:${String(minute).padStart(2, '0')}:00Z`,
    delay: 0,
    line,
    type: 'bus',
    directionId: '0',
    headsign: 'Centrum',
    isCanceled: false,
    stopId: 'A',
    ...extra,
});

const minutesOf = (departures: AppDeparture[]) => departures.map(d => `${d.stopId}:${d.line}:${d.timestamp.slice(14, 16)}`);

describe('capPerLine', () => {
    it('keeps the next departures of each line by expected time', () => {
        const departures = [dep(9, '1'), dep(1, '1'), dep(2, '2'), dep(5, '1'), dep(3, '1')];
        expect(minutesOf(capPerLine({ departures }, 2).departures)).toEqual(['A:1:01', 'A:2:02', 'A:1:03']);
    });

    it('counts each stop and direction separately', () => {
        const departures = [dep(1, '1'), dep(2, '1', { headsign: 'Sídliště' }), dep(3, '1', { stopId: 'B' }), dep(4, '1')];
        expect(minutesOf(capPerLine({ departures }, 1).departures)).toEqual(['A:1:01', 'A:1:02', 'B:1:03']);
    });

    // A card that hides cancelled departures must still find its full count.
    it('keeps cancelled departures without counting them', () => {
        const departures = [dep(1, '1', { isCanceled: true }), dep(2, '1'), dep(3, '1')];
        expect(minutesOf(capPerLine({ departures }, 1).departures)).toEqual(['A:1:01', 'A:1:02']);
    });

});
