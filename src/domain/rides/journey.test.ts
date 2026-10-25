import { describe, expect, it } from 'vitest';
import { isOnJourney, journeyMark, journeySpan, linkSequence } from './journey';

const board = { sequence: 4, stopId: 'p4', stopName: 'Stop 4', scheduledMs: 0, leadMin: null };

describe('journeySpan', () => {
    it('runs from the boarding stop ahead of the vehicle to the exit', () => {
        const span = journeySpan({ board, exitSequence: 8 }, 2, null);
        expect(span).toMatchObject({ boardSequence: 4, start: 4, end: 8 });
        expect([4, 5, 8, 9].map(s => isOnJourney(s, span))).toEqual([false, true, true, false]);
    });

    it('runs from the vehicle once it passed the boarding stop', () => {
        expect(journeySpan({ board, exitSequence: 8 }, 6, null)).toMatchObject({ boardSequence: null, start: 6 });
    });

    it('follows a shared exit without a trip of the user, and has no journey without either', () => {
        expect(journeySpan(null, 1, 5)).toMatchObject({ start: 1, end: 5 });
        expect(isOnJourney(3, journeySpan(null, 1, null))).toBe(false);
    });
});

describe('journeyMark', () => {
    it("marks the user's exit over a shared exit at the same stop, and their boarding stop", () => {
        const span = journeySpan({ board, exitSequence: 8 }, 2, 8);
        expect([4, 8, 5].map(s => journeyMark(s, span))).toEqual(['board', 'own', null]);
        expect(journeyMark(7, journeySpan(null, 2, 7))).toBe('shared');
    });
});

describe('linkSequence', () => {
    it('reads a number, and nothing from an absent, empty or malformed parameter', () => {
        expect([linkSequence('3'), linkSequence(null), linkSequence(''), linkSequence('x')]).toEqual([3, null, null, null]);
    });
});
