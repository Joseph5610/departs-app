import { describe, expect, it } from 'vitest';
import { delayAtStop, hasLeftStop, isBoardingOver, liveStopSequence, stopsLeft, TRIP_RULES } from './rides';

const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);
const call = (stop_sequence: number, departure_time = '12:00:00', realtime_departure_time?: string) =>
    ({ properties: { stop_sequence, departure_time, realtime_departure_time } });

describe('liveStopSequence', () => {
    // A timetable-only or not-started trip says nothing about where the vehicle is.
    it('reads the last stop only from a live, started trip', () => {
        expect(liveStopSequence({ state_position: 'on_track', last_stop_sequence: 3 })).toBe(3);
        expect(liveStopSequence({ state_position: 'on_track', last_stop_sequence: 3, is_static_fallback: true })).toBeNull();
        expect(liveStopSequence({ state_position: 'before_track', last_stop_sequence: 1 })).toBeNull();
        expect(liveStopSequence(null)).toBeNull();
    });
});

describe('hasLeftStop and isBoardingOver', () => {
    it('counts a vehicle standing at the stop as not yet left', () => {
        expect(hasLeftStop({ state_position: 'at_stop', last_stop_sequence: 3 }, 3)).toBe(false);
        expect(hasLeftStop({ state_position: 'on_track', last_stop_sequence: 3 }, 3)).toBe(true);
        expect(hasLeftStop({ state_position: 'on_track', last_stop_sequence: 2 }, 3)).toBe(false);
        expect(hasLeftStop(null, 3)).toBeNull();
    });

    // A live position can stall at a stop: the clock ends boarding anyway.
    it('ends boarding when the vehicle left, or by the clock after the grace', () => {
        const before = { state_position: 'on_track', last_stop_sequence: 2 };
        expect(isBoardingOver(before, 3, NOW, NOW)).toBe(false);
        expect(isBoardingOver(before, 3, NOW, NOW + TRIP_RULES.BOARD_GRACE_MS)).toBe(true);
        expect(isBoardingOver({ state_position: 'on_track', last_stop_sequence: 4 }, 3, NOW + 600_000, NOW)).toBe(true);
    });
});

describe('stopsLeft', () => {
    // Brno's GTFS-RT gives sparse stop sequences; stops left counts real stops, not sequence gaps.
    it('counts stops, not sequence numbers', () => {
        expect(stopsLeft([10, 20, 30, 40].map(s => call(s)), 20, 40)).toBe(2);
    });
});

describe('delayAtStop', () => {
    it('prefers the stop realtime time, wrapping midnight, then the trip delay', () => {
        expect(delayAtStop([call(3, '12:00:00', '12:02:30')], 3, 60)).toBe(150);
        expect(delayAtStop([call(3, '23:58:00', '00:02:00')], 3, null)).toBe(240);
        expect(delayAtStop([call(3)], 3, 60)).toBe(60);
        expect(delayAtStop([call(3)], 3, null)).toBeNull();
    });
});
