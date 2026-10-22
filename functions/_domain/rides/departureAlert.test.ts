import { describe, expect, it } from 'vitest';
import type { AppVehicleDetail } from '../../_core/types';
import { departureAlertFor, minutesUntilDeparture, nextCheckAt, predictedDepartureMs } from './departureAlert';

const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);
const MIN = 60_000;

const stop = (stop_sequence: number, realtime?: string) => ({
    type: 'Feature' as const,
    properties: { stop_id: `s${stop_sequence}`, stop_name: `Stop ${stop_sequence}`, stop_sequence, arrival_time: '12:10:00', departure_time: '12:10:00', realtime_departure_time: realtime },
});

const detail = (extra: Partial<AppVehicleDetail> = {}) => ({
    state_position: 'on_track' as AppVehicleDetail['state_position'],
    last_stop_sequence: 2,
    delay: 0 as number | null,
    stop_times: { features: [stop(1), stop(2), stop(3), stop(4)] },
    ...extra,
});

// The rider boards at stop 4, scheduled 20 min from now, and wants 5 min warning.
const timing = { boardSequence: 4, scheduledMs: NOW + 20 * MIN, leadMin: 5 };

describe('predictedDepartureMs', () => {
    it('uses the realtime time at the rider stop', () => {
        const d = detail({ delay: 30, stop_times: { features: [stop(3), stop(4, '12:12:00')] } });
        expect(predictedDepartureMs(d, timing)).toBe(timing.scheduledMs + 2 * MIN);
    });

    it('falls back to the trip delay, then to the timetable', () => {
        expect(predictedDepartureMs(detail({ delay: 180 }), timing)).toBe(timing.scheduledMs + 3 * MIN);
        expect(predictedDepartureMs(detail({ delay: null }), timing)).toBe(timing.scheduledMs);
        expect(predictedDepartureMs(null, timing)).toBe(timing.scheduledMs);
    });

    it('ignores the delay of a timetable-only detail', () => {
        expect(predictedDepartureMs(detail({ is_static_fallback: true, delay: 300 }), timing)).toBe(timing.scheduledMs);
    });

    it('handles a realtime time past midnight', () => {
        const late = { features: [{ ...stop(4, '00:02:00'), properties: { ...stop(4).properties, departure_time: '23:58:00', realtime_departure_time: '00:02:00' } }] };
        expect(predictedDepartureMs(detail({ stop_times: late }), timing)).toBe(timing.scheduledMs + 4 * MIN);
    });
});

describe('departureAlertFor', () => {
    it('reminds once the predicted departure is within the lead time', () => {
        expect(departureAlertFor(detail(), timing, NOW + 14 * MIN)).toBeNull();
        expect(departureAlertFor(detail(), timing, NOW + 15 * MIN)).toBe('soon');
    });

    // One more check would come after the moment, so a reminder this close goes out now.
    it('sends a reminder due within the send window', () => {
        expect(departureAlertFor(detail(), timing, NOW + 14.6 * MIN)).toBe('soon');
        expect(departureAlertFor(detail(), timing, NOW + 14 * MIN)).toBeNull();
    });

    it('waits for a delayed trip', () => {
        expect(departureAlertFor(detail({ delay: 240 }), timing, NOW + 15 * MIN)).toBeNull();
        expect(departureAlertFor(detail({ delay: 240 }), timing, NOW + 19 * MIN)).toBe('soon');
    });

    it('reminds on the timetable when no detail could be read', () => {
        expect(departureAlertFor(null, timing, NOW + 15 * MIN)).toBe('soon');
    });

    it('reports a cancelled trip', () => {
        expect(departureAlertFor(detail({ state_position: 'canceled' }), timing, NOW)).toBe('cancelled');
    });

    // A reminder for a stop the vehicle already left is useless.
    it('drops the reminder once the vehicle passed the rider stop', () => {
        expect(departureAlertFor(detail({ last_stop_sequence: 4 }), timing, NOW)).toBe('passed');
        expect(departureAlertFor(detail({ last_stop_sequence: 4, state_position: 'at_stop' }), timing, NOW)).toBeNull();
        expect(departureAlertFor(detail({ last_stop_sequence: 4, state_position: 'before_track' }), timing, NOW)).toBeNull();
    });
});

describe('nextCheckAt', () => {
    it('sleeps until the first check before the reminder is due', () => {
        expect(nextCheckAt(null, timing, NOW)).toBe(NOW + 5 * MIN);
    });

    it('halves the time left, never under the minimum interval nor past the due moment', () => {
        expect(nextCheckAt(detail(), timing, NOW + 7 * MIN)).toBe(NOW + 11 * MIN);
        expect(nextCheckAt(detail(), timing, NOW + 14.8 * MIN)).toBe(NOW + 14.8 * MIN + 30_000);
    });
});

describe('minutesUntilDeparture', () => {
    it('rounds to whole minutes, at least one', () => {
        expect(minutesUntilDeparture(detail({ delay: 60 }), timing, NOW + 15 * MIN)).toBe(6);
        expect(minutesUntilDeparture(null, timing, NOW + 20 * MIN)).toBe(1);
    });
});
