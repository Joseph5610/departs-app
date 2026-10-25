import { describe, expect, it } from 'vitest';
import type { AppVehicleDetail } from '../../_core/types';
import { observe } from './observation';
import { isNearExit, rideAlertFor } from './rideAlert';

const stop = (stop_sequence: number) => ({
    type: 'Feature' as const,
    properties: { stop_id: `s${stop_sequence}`, stop_name: `Stop ${stop_sequence}`, stop_sequence, arrival_time: '12:00:00', departure_time: '12:00:00' },
});

const detail = (last_stop_sequence: number | null, extra: Partial<AppVehicleDetail> = {}) => observe({
    state_position: 'on_track',
    last_stop_sequence,
    delay: 0,
    stop_times: { features: [1, 2, 3, 4, 5, 6].map(stop) },
    ...extra,
});

describe('rideAlertFor', () => {
    it('alerts next once the vehicle has passed the stop before the exit', () => {
        expect(rideAlertFor(detail(3), 5)).toBeNull();
        expect(rideAlertFor(detail(4), 5)).toBe('next');
    });

    it('alerts arrived at the exit and past it', () => {
        expect(rideAlertFor(detail(5), 5)).toBe('arrived');
        expect(rideAlertFor(detail(6), 5)).toBe('arrived');
    });

    it('alerts arrived when the trip reaches its last stop before the exit is seen', () => {
        expect(rideAlertFor(detail(6), 9)).toBe('arrived');
    });

    // A timetable-only position says nothing about where the vehicle really is.
    it('ignores static fallback and not-started trips', () => {
        expect(rideAlertFor(detail(4, { is_static_fallback: true }), 5)).toBeNull();
        expect(rideAlertFor(detail(4, { state_position: 'before_track' }), 5)).toBeNull();
        expect(rideAlertFor(detail(null), 5)).toBeNull();
    });

    // Brno's GTFS-RT gives sparse stop sequences; stops left counts real stops, not sequence gaps.
    it('counts stops, not sequence numbers', () => {
        const sparse = observe({ state_position: 'on_track', last_stop_sequence: 20, delay: 0, stop_times: { features: [10, 20, 30, 40].map(stop) } });
        expect(rideAlertFor(sparse, 30)).toBe('next');
        expect(rideAlertFor(sparse, 40)).toBeNull();
    });
});

describe('isNearExit', () => {
    it('is near within two stops of the exit', () => {
        expect(isNearExit(detail(2), 5)).toBe(false);
        expect(isNearExit(detail(3), 5)).toBe(true);
    });
});
