import { describe, expect, it } from 'vitest';
import type { MyTrip, MyTripTarget } from '@/types';
import { sheetSelection, tripFromSheet, type SheetBoarding, type SheetExit } from './sheet';

const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);
const MIN = 60_000;

const boarding = (sequence: number, extra: Partial<SheetBoarding> = {}): SheetBoarding => ({
    sequence, stopId: `p${sequence}`, stopName: `Stop ${sequence}`, scheduledMs: NOW + sequence * 5 * MIN,
    delaySecs: 0, time: null, coordinates: null, leads: [2, 5, 10], walkLead: null, ...extra,
});
const exit = (sequence: number): SheetExit => ({ sequence, stopName: `Stop ${sequence}`, time: null });
const boardings = [boarding(2), boarding(3, { walkLead: 7 }), boarding(4)];
const exits = [exit(3), exit(4), exit(5)];
const target: MyTripTarget = { city: 'prague', tripId: 't1', vehicleId: 'v1', stopId: 'station-3' };
const lastStop = { sequence: 5, stopName: 'Stop 5' };

const saved = (extra: Partial<MyTrip> = {}): MyTrip => ({
    city: 'prague', tripId: 't1', vehicleId: 'v0', exitSequence: 4, toEnd: false, startedAt: NOW,
    board: { sequence: 2, stopId: 'p2', stopName: 'Stop 2', scheduledMs: NOW + 10 * MIN, leadMin: 10 },
    ...extra,
});

describe('sheetSelection', () => {
    it('opens on the stop the sheet was opened at, with the walk lead, riding to the end', () => {
        expect(sheetSelection({ draft: {}, existing: null, openedAt: 3, isRunning: true, boardings, exits })).toMatchObject({ boarding: { sequence: 3 }, lead: 7, exit: null });
    });

    it('shows the saved trip, and a draft over it', () => {
        expect(sheetSelection({ draft: {}, existing: saved(), openedAt: 3, isRunning: true, boardings, exits })).toMatchObject({ boarding: { sequence: 2 }, lead: 10, exit: { sequence: 4 } });
        expect(sheetSelection({ draft: { board: 3, exit: null }, existing: saved(), openedAt: 3, isRunning: true, boardings, exits })).toMatchObject({ boarding: { sequence: 3 }, lead: 7, exit: null });
    });

    // Only a running trip can be taken already aboard: one not yet running needs a boarding stop.
    it('boards a trip not yet running at its first stop, unless the user picked one', () => {
        expect(sheetSelection({ draft: {}, existing: null, openedAt: null, isRunning: false, boardings, exits }).boarding?.sequence).toBe(2);
        expect(sheetSelection({ draft: {}, existing: null, openedAt: null, isRunning: true, boardings, exits }).boarding).toBeNull();
        expect(sheetSelection({ draft: { board: 4 }, existing: null, openedAt: null, isRunning: false, boardings, exits }).boarding?.sequence).toBe(4);
    });

    it('offers exits after the boarding and boardings before the exit', () => {
        const selection = sheetSelection({ draft: { board: 3, exit: 4 }, existing: null, openedAt: null, isRunning: true, boardings, exits });
        expect(selection.exits.map(e => e.sequence)).toEqual([4, 5]);
        expect(selection.boardings.map(b => b.sequence)).toEqual([2, 3]);
    });
});

describe('tripFromSheet', () => {
    const save = (draft: Parameters<typeof tripFromSheet>[0]['draft'], existing: MyTrip | null = null) =>
        tripFromSheet({ target, existing, selection: sheetSelection({ draft, existing, openedAt: 3, isRunning: true, boardings, exits }), draft, openedAt: 3, lastStop });

    // The board id reopens the sheet on the stop: it must be the stop picked, not the one the sheet came from.
    it('keeps the opened board id only for that stop', () => {
        expect(save({}).board?.stopId).toBe('station-3');
        expect(save({ board: 4 }).board?.stopId).toBe('p4');
    });

    it('rides to the last stop without an exit, and keeps an edited trip on its vehicle', () => {
        expect(save({})).toMatchObject({ exitSequence: 5, toEnd: true, vehicleId: 'v1' });
        expect(save({ exit: 4 }, saved())).toMatchObject({ exitSequence: 4, toEnd: false, vehicleId: 'v0' });
    });

    // A boarding the vehicle already passed is no longer offered; dropping it would re-register the trip.
    it('keeps a saved boarding no longer offered unless the user picked "aboard"', () => {
        const behind = saved({ board: { sequence: 1, stopId: 'p1', stopName: 'Stop 1', scheduledMs: NOW, leadMin: 5 } });
        expect(save({}, behind).board?.sequence).toBe(1);
        expect(save({ board: null }, behind).board).toBeNull();
    });
});
