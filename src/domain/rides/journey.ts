import type { JourneyMark, MyTrip } from '@/types';

export interface JourneySpan {
    /** The user's boarding stop while the vehicle hasn't reached it yet. */
    boardSequence: number | null;
    /** The stretch still to ride lies after `start` up to and including `end`; null `end`: no journey on this trip. */
    start: number;
    end: number | null;
    ownExit: number | null;
    sharedExit: number | null;
}

/** The stretch still to ride on a trip: from the user's boarding stop (or the vehicle) to their exit, else a shared trip's exit. */
export const journeySpan = (trip: Pick<MyTrip, 'board' | 'exitSequence'> | null, currentSequence: number | null, sharedExit: number | null): JourneySpan => {
    const boardSequence = trip?.board && (currentSequence ?? 0) < trip.board.sequence ? trip.board.sequence : null;
    const ownExit = trip?.exitSequence ?? null;
    return { boardSequence, start: Math.max(currentSequence ?? 0, boardSequence ?? 0), end: ownExit ?? sharedExit, ownExit, sharedExit };
};

/** A stop's mark on the journey; the user's own exit wins over their boarding stop and a shared exit. */
export const journeyMark = (sequence: number, span: JourneySpan): JourneyMark =>
    sequence === span.ownExit ? 'own' : sequence === span.boardSequence ? 'board' : sequence === span.sharedExit ? 'shared' : null;

export const isOnJourney = (sequence: number, span: JourneySpan): boolean => span.end !== null && sequence > span.start && sequence <= span.end;

/** A shared link's stop sequence (`?board=`, `?exit=`); null when absent or not a number. */
export const linkSequence = (param: string | null): number | null =>
    param !== null && param !== '' && Number.isFinite(Number(param)) ? Number(param) : null;
