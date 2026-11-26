import { describe, expect, it } from 'vitest';
import { mergeTrafficReports, type DukVehicleReport } from './dukTrafficFeed';

const NOW = Date.parse('2026-11-26T20:40:00Z');
const HOLD = 120_000;

const report = (vehicleId: string, secondsAgo: number | null, latitude = 50.66): DukVehicleReport => ({
    vehicleId, lineNumber: '592452', tripNumber: 12, trainNumber: null, lineName: '452', delay: 0,
    latitude, longitude: 14.04, bearing: null, stationNode: null, stationArrivalMs: null, stationDepartureMs: null,
    finalNode: null, state: null, isLowFloor: null, isAirConditioned: null, feedTripId: null,
    timestamp: secondsAgo === null ? null : new Date(NOW - secondsAgo * 1000).toISOString(),
});

describe('mergeTrafficReports', () => {
    it('takes a vehicle listed again from the new read', () => {
        const merged = mergeTrafficReports([report('1', 30, 50.1)], [report('1', 5, 50.2)], NOW, HOLD);
        expect(merged).toHaveLength(1);
        expect(merged[0]!.latitude).toBe(50.2);
    });

    // Portabo alternates its whole fleet with a part of it.
    it('keeps a vehicle a partial read leaves out while its last report is recent', () => {
        const merged = mergeTrafficReports([report('1', 5), report('2', 30)], [report('1', 2)], NOW, HOLD);
        expect(merged.map(r => r.vehicleId)).toEqual(['1', '2']);
    });

    it('drops a missing vehicle once its last report is older than the hold', () => {
        expect(mergeTrafficReports([report('2', 121)], [], NOW, HOLD)).toEqual([]);
    });

    it('drops a missing vehicle that never said when it reported', () => {
        expect(mergeTrafficReports([report('2', null)], [], NOW, HOLD)).toEqual([]);
    });
});
