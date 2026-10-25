import { describe, expect, it } from 'vitest';
import type { AppVehicleDetail } from '../../_core/types';
import { carriedAlerts, firstCheckAt, needsLiveDetail, riderStep, type WatchRider } from './tripWatch';

const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);
const MIN = 60_000;

const stop = (stop_sequence: number) => ({
    type: 'Feature' as const,
    properties: { stop_id: `s${stop_sequence}`, stop_name: `Stop ${stop_sequence}`, stop_sequence, arrival_time: '12:00:00', departure_time: '12:00:00' },
});

const detail = (last_stop_sequence: number | null, extra: Partial<AppVehicleDetail> = {}) => ({
    state_position: (last_stop_sequence === null ? 'before_track' : 'on_track') as AppVehicleDetail['state_position'],
    last_stop_sequence,
    delay: 0 as number | null,
    stop_times: { features: [1, 2, 3, 4, 5, 6].map(stop) },
    ...extra,
});

// Boards at stop 3 in 20 min with a 5 min alert, gets off at stop 6.
const rider = (extra: Partial<WatchRider> = {}): WatchRider => ({
    exitSequence: 6,
    board: { sequence: 3, scheduledMs: NOW + 20 * MIN, leadMin: 5 },
    alerted: [],
    ...extra,
});

describe('riderStep', () => {
    it('waits for the boarding alert, then sends it once inside the lead', () => {
        expect(riderStep(rider(), detail(1), NOW)).toMatchObject({ send: [], done: false, nextAt: NOW + 5 * MIN });
        expect(riderStep(rider(), detail(2), NOW + 15 * MIN)).toMatchObject({ send: ['soon'], alerted: ['soon'], done: false });
    });

    // Prague without a vehicle id: the detail is the timetable, the alert still comes on time.
    it('sends the boarding alert on the timetable without a detail', () => {
        expect(riderStep(rider(), null, NOW + 15 * MIN).send).toEqual(['soon']);
    });

    it('does not watch the exit hours before boarding', () => {
        const step = riderStep(rider({ board: { sequence: 3, scheduledMs: NOW + 120 * MIN, leadMin: null } }), null, NOW);
        expect(step.nextAt).toBe(NOW + 110 * MIN);
    });

    it('alerts the exit once aboard, and finishes on arrival', () => {
        const aboard = rider({ alerted: ['soon'] });
        expect(riderStep(aboard, detail(5), NOW + 25 * MIN)).toMatchObject({ send: ['next'], done: false });
        expect(riderStep({ ...aboard, alerted: ['soon', 'next'] }, detail(6), NOW + 30 * MIN)).toMatchObject({ send: ['arrived'], done: true });
    });

    // A vehicle standing at the rider's stop hasn't left: no exit watch yet, the boarding alert still comes.
    it('treats a vehicle standing at the boarding stop as not yet left', () => {
        expect(riderStep(rider(), detail(3, { state_position: 'at_stop' }), NOW + 15 * MIN).send).toEqual(['soon']);
    });

    it('marks a boarding alert the vehicle already passed, without sending it late', () => {
        expect(riderStep(rider(), detail(4), NOW + 10 * MIN)).toMatchObject({ send: [], alerted: ['soon'], done: false });
    });

    it('reports a cancelled trip and finishes', () => {
        expect(riderStep(rider(), detail(1, { state_position: 'canceled' }), NOW)).toMatchObject({ send: ['cancelled'], done: true });
    });

    // Kept past its alert until the trip leaves, so a re-save adding an exit carries the alert instead of sending it again.
    it('finishes a boarding-only rider once the trip has left, not when its alert went', () => {
        const boardingOnly = rider({ exitSequence: null });
        expect(riderStep(boardingOnly, detail(2), NOW + 15 * MIN)).toMatchObject({ send: ['soon'], done: false, nextAt: NOW + 22 * MIN });
        expect(riderStep({ ...boardingOnly, alerted: ['soon'] }, detail(3), NOW + 21 * MIN)).toMatchObject({ send: [], done: true, nextAt: null });
    });

    it('watches an exit straight away for a rider already aboard', () => {
        expect(riderStep(rider({ board: null }), detail(2), NOW)).toMatchObject({ send: [], done: false, nextAt: NOW + 90_000 });
    });
});

describe('firstCheckAt and needsLiveDetail', () => {
    it('starts at the boarding alert first check, or now when aboard', () => {
        expect(firstCheckAt(rider(), NOW)).toBe(NOW + 5 * MIN);
        expect(firstCheckAt(rider({ board: null }), NOW)).toBe(NOW);
        expect(needsLiveDetail(rider(), NOW)).toBe(false);
        expect(needsLiveDetail(rider(), NOW + 6 * MIN)).toBe(true);
    });
});

describe('firstCheckAt when an alert is already due', () => {
    // Registered inside its lead (a 15 min alert 12 min ahead): the alert must go now, not after the exit watch starts.
    it('looks now, not at the exit watch start', () => {
        expect(firstCheckAt(rider({ board: { sequence: 3, scheduledMs: NOW + 12 * MIN, leadMin: 15 } }), NOW)).toBe(NOW);
    });
});

describe('carriedAlerts', () => {
    // A re-save with another lead or exit must not send what already went.
    it('keeps the boarding alert at the same stop and the exit alerts at the same exit', () => {
        const sent = rider({ alerted: ['soon', 'next'] });
        expect(carriedAlerts(sent, rider())).toEqual(['soon', 'next']);
        expect(carriedAlerts(sent, rider({ exitSequence: 5 }))).toEqual(['soon']);
        expect(carriedAlerts(sent, rider({ board: { sequence: 2, scheduledMs: NOW, leadMin: 5 } }))).toEqual(['next']);
        expect(carriedAlerts(undefined, rider())).toEqual([]);
    });
});

describe('boarding alert without a live position', () => {
    // A trip whose timetable departure is behind, with no position to say otherwise, is gone: no late "leaves in 1 min".
    it('is dropped once the departure is behind', () => {
        expect(riderStep(rider({ exitSequence: null }), null, NOW + 21 * MIN)).toMatchObject({ send: [], alerted: ['soon'] });
        expect(riderStep(rider({ exitSequence: null, alerted: ['soon'] }), null, NOW + 23 * MIN)).toMatchObject({ send: [], done: true });
    });
});
