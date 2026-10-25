import type { MyTrip, MyTripTarget, TripStart } from '@/types';
import { defaultLead, type BoardingChoice } from './boarding';
import { boardingsBefore, exitsAfter } from './myTrip';

/** A boarding stop the sheet offers, with the lead from the user's walk there (null: unknown or not possible). */
export type SheetBoarding = BoardingChoice & { walkLead: number | null };

export interface SheetExit {
    sequence: number;
    stopName: string;
    time: string | null;
}

/** What the user changed in the sheet; `undefined` keeps the default, null picks "none" (aboard already, no alert, to the end). */
export interface TripDraft {
    board?: number | null;
    lead?: number | null;
    exit?: number | null;
}

export interface SheetSelection {
    boarding: SheetBoarding | null;
    lead: number | null;
    exit: SheetExit | null;
    /** The exits offered after the picked boarding, and the boardings before the picked exit. */
    exits: SheetExit[];
    boardings: SheetBoarding[];
}

/**
 * What the sheet shows picked: the user's draft, else their saved trip, else the stop it was opened at with the walk's
 * lead (or the default); the exit is the draft's or the saved one, else none (to the end).
 */
export const sheetSelection = ({ draft, existing, openedAt, boardings, exits }: {
    draft: TripDraft;
    existing: MyTrip | null;
    openedAt: number | null;
    boardings: readonly SheetBoarding[];
    exits: readonly SheetExit[];
}): SheetSelection => {
    const boardSequence = draft.board !== undefined ? draft.board : existing ? existing.board?.sequence ?? null : openedAt;
    const boarding = boardings.find(b => b.sequence === boardSequence) ?? null;
    const lead = draft.lead !== undefined ? draft.lead
        : existing?.board && existing.board.sequence === boardSequence ? existing.board.leadMin
        : boarding ? defaultLead(boarding.leads, boarding.walkLead) : null;
    const exitSequence = draft.exit !== undefined ? draft.exit : existing && !existing.toEnd ? existing.exitSequence : null;
    const exit = exitSequence === null ? null : exits.find(e => e.sequence === exitSequence) ?? null;
    return { boarding, lead, exit, exits: exitsAfter(exits, boarding?.sequence ?? null), boardings: boardingsBefore(boardings, exitSequence) };
};

/**
 * The trip the sheet saves. An edit keeps the trip's vehicle (its push registration names it). The boarding keeps the
 * board id the sheet was opened at only while it is that stop; a boarding already behind (no longer offered) stays as
 * saved unless the user picked another, as dropping it would re-register the trip and repeat its alerts.
 */
export const tripFromSheet = ({ target, existing, selection, draft, openedAt, start, lastStop }: {
    target: MyTripTarget;
    existing: MyTrip | null;
    selection: Pick<SheetSelection, 'boarding' | 'lead' | 'exit'>;
    draft: TripDraft;
    openedAt: number | null;
    start: TripStart | null;
    lastStop: { sequence: number; stopName: string };
}): Omit<MyTrip, 'startedAt'> => {
    const { boarding, lead, exit } = selection;
    const exitStop = exit ?? lastStop;
    return {
        city: target.city,
        tripId: target.tripId,
        vehicleId: existing ? existing.vehicleId : target.vehicleId,
        exitSequence: exitStop.sequence,
        exitStopName: exitStop.stopName,
        toEnd: exit === null,
        board: boarding
            ? {
                sequence: boarding.sequence,
                stopId: boarding.sequence === openedAt && target.stopId ? target.stopId : boarding.stopId,
                stopName: boarding.stopName,
                scheduledMs: boarding.scheduledMs,
                leadMin: lead,
            }
            : draft.board === undefined ? existing?.board ?? null : null,
        start: boarding ? null : start ?? existing?.start ?? null,
    };
};
