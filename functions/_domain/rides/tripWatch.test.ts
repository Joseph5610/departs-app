import { describe, expect, it } from 'vitest';
import type { AppVehicleDetail } from '../../_core/types';
import { observe } from './observation';
import { firstCheckAt, initialPhase, riderStep, type WatchRider } from './tripWatch';

const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);
const MIN = 60_000;

const stop = (stop_sequence: number) => ({
    type: 'Feature' as const,
    properties: { stop_id: `s${stop_sequence}`, stop_name: `Stop ${stop_sequence}`, stop_sequence, arrival_time: '12:00:00', departure_time: '12:00:00' },
});

const FAILED = observe(null);

const detail = (last_stop_sequence: number | null, extra: Partial<AppVehicleDetail> = {}) => observe({
    state_position: last_stop_sequence === null ? 'before_track' : 'on_track',
    last_stop_sequence,
    delay: 0,
    stop_times: { features: [1, 2, 3, 4, 5, 6].map(stop) },
    ...extra,
});

// Boards at stop 3 in 20 min with a 5 min alert, gets off at stop 6.
const rider = (extra: Partial<WatchRider> = {}): WatchRider => ({
    exitSequence: 6,
    board: { sequence: 3, scheduledMs: NOW + 20 * MIN, leadMin: 5 },
    phase: 'remind',
    ...extra,
});

describe('riderStep', () => {
    // One failed read after the timetable departure must not lose the alert of a trip running late.
    it('keeps a pending boarding alert through a failed read, then sends it late-but-due', () => {
        expect(riderStep(rider(), FAILED, NOW + 21 * MIN)).toMatchObject({ send: [], phase: 'remind' });
        expect(riderStep(rider(), detail(2, { delay: 360 }), NOW + 22 * MIN)).toMatchObject({ send: ['soon'], phase: 'board' });
    });

    it('ends boarding on the clock when a live position stalls before the stop', () => {
        expect(riderStep(rider({ phase: 'board' }), detail(2), NOW + 23 * MIN)).toMatchObject({ phase: 'ride' });
    });

    it('waits for the boarding alert, then sends it once inside the lead', () => {
        expect(riderStep(rider(), detail(1), NOW)).toMatchObject({ send: [], phase: 'remind', nextAt: NOW + 5 * MIN });
        expect(riderStep(rider(), detail(2), NOW + 15 * MIN)).toMatchObject({ send: ['soon'], phase: 'board' });
    });

    // Prague without a vehicle id: the detail is the timetable, the alert still comes on time.
    it('sends the boarding alert on the timetable without a detail', () => {
        expect(riderStep(rider(), FAILED, NOW + 15 * MIN).send).toEqual(['soon']);
    });

    it('does not watch the exit hours before boarding', () => {
        const step = riderStep(rider({ board: { sequence: 3, scheduledMs: NOW + 120 * MIN, leadMin: null }, phase: 'board' }), FAILED, NOW);
        expect(step.nextAt).toBe(NOW + 110 * MIN);
    });

    it('alerts the exit once aboard, and finishes on arrival', () => {
        expect(riderStep(rider({ phase: 'board' }), detail(5), NOW + 25 * MIN)).toMatchObject({ send: ['next'], phase: 'near' });
        expect(riderStep(rider({ phase: 'near' }), detail(5), NOW + 26 * MIN)).toMatchObject({ send: [], phase: 'near' });
        expect(riderStep(rider({ phase: 'near' }), detail(6), NOW + 30 * MIN)).toMatchObject({ send: ['arrived'], phase: 'done', nextAt: null });
    });

    // A vehicle standing at the rider's stop hasn't left: no exit watch yet, the boarding alert still comes.
    it('treats a vehicle standing at the boarding stop as not yet left', () => {
        expect(riderStep(rider(), detail(3, { state_position: 'at_stop' }), NOW + 15 * MIN).send).toEqual(['soon']);
    });

    it('marks a boarding alert the vehicle already passed, without sending it late', () => {
        expect(riderStep(rider(), detail(4), NOW + 10 * MIN)).toMatchObject({ send: [], phase: 'ride' });
    });

    it('reports a cancelled trip and finishes', () => {
        expect(riderStep(rider(), detail(1, { state_position: 'canceled' }), NOW)).toMatchObject({ send: ['cancelled'], phase: 'done' });
    });

    // Kept past its alert until the trip leaves, so a re-save adding an exit carries the alert instead of sending it again.
    it('finishes a boarding-only rider once the trip has left, not when its alert went', () => {
        const boardingOnly = rider({ exitSequence: null });
        expect(riderStep(boardingOnly, detail(2), NOW + 15 * MIN)).toMatchObject({ send: ['soon'], phase: 'board', nextAt: NOW + 22 * MIN });
        expect(riderStep({ ...boardingOnly, phase: 'board' }, detail(3), NOW + 21 * MIN)).toMatchObject({ send: [], phase: 'done', nextAt: null });
    });

    it('watches an exit straight away for a rider already aboard', () => {
        expect(riderStep(rider({ board: null, phase: 'board' }), detail(2), NOW)).toMatchObject({ send: [], phase: 'ride', nextAt: NOW + 90_000 });
    });
});

describe('firstCheckAt', () => {
    it('starts at the boarding alert first check, or now when aboard', () => {
        expect(firstCheckAt(rider(), NOW)).toBe(NOW + 5 * MIN);
        expect(firstCheckAt(rider({ board: null, phase: 'board' }), NOW)).toBe(NOW);
    });
});

describe('firstCheckAt when an alert is already due', () => {
    // Registered inside its lead (a 15 min alert 12 min ahead): the alert must go now, not after the exit watch starts.
    it('looks now, not at the exit watch start', () => {
        expect(firstCheckAt(rider({ board: { sequence: 3, scheduledMs: NOW + 12 * MIN, leadMin: 15 } }), NOW)).toBe(NOW);
    });
});

describe('initialPhase', () => {
    it('starts at the boarding alert, else waiting to board, else with nothing to do', () => {
        expect(initialPhase(rider())).toBe('remind');
        expect(initialPhase(rider({ board: null }))).toBe('board');
        expect(initialPhase(rider({ board: null, exitSequence: null }))).toBe('done');
    });
});

describe('boarding alert without a live position', () => {
    // A trip whose timetable departure is behind, with no position to say otherwise, is gone: no late "leaves in 1 min".
    it('is dropped once the departure is behind', () => {
        const timetable = detail(null, { is_static_fallback: true });
        expect(riderStep(rider({ exitSequence: null }), timetable, NOW + 21 * MIN)).toMatchObject({ send: [], phase: 'board' });
        expect(riderStep(rider({ exitSequence: null, phase: 'board' }), FAILED, NOW + 23 * MIN)).toMatchObject({ send: [], phase: 'done' });
    });
});
