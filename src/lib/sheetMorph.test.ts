import { describe, expect, it } from 'vitest';
import { peekGapPx, scrollTravel, sheetContentOpacity, sheetControlsOpacity, sheetMorph, snapHeight, toolbarFolded } from './sheetMorph';

const HEIGHTS = { peek: 98, half: 523, full: 788 };

describe('sheetMorph', () => {
    it('is a capsule at the peek and fully morphed at half', () => {
        expect(sheetMorph(98, HEIGHTS)).toEqual({ morph: 0, rise: 0 });
        expect(sheetMorph(523, HEIGHTS)).toEqual({ morph: 1, rise: 0 });
    });

    it('rises only between half and full, and stays in range past the detents', () => {
        expect(sheetMorph(788, HEIGHTS).rise).toBe(1);
        expect(sheetMorph(40, HEIGHTS).morph).toBe(0);
        expect(sheetMorph(900, HEIGHTS).rise).toBe(1);
    });

    it('hides the content until a fifth of the morph', () => {
        expect(sheetContentOpacity(0.2)).toBe(0);
        expect(sheetContentOpacity(0.5)).toBeCloseTo(0.5);
        expect(sheetContentOpacity(1)).toBe(1);
    });

    it('fades the controls out by a third of the way to full', () => {
        expect(sheetControlsOpacity(0)).toBe(1);
        expect(sheetControlsOpacity(1 / 3)).toBeCloseTo(0);
    });

    it('keeps the capsule over the home indicator', () => {
        expect(peekGapPx(0)).toBe(12);
        expect(peekGapPx(34)).toBe(30);
        expect(peekGapPx(48)).toBe(44);
    });

    const RUN = { startPx: 24, runPx: 24 };

    it('folds the toolbar on a run down and restores it on a run up or at the start', () => {
        expect(toolbarFolded(false, 200, 30, RUN)).toBe(true);
        expect(toolbarFolded(true, 200, -30, RUN)).toBe(false);
        expect(toolbarFolded(true, 10, 30, RUN)).toBe(false);
    });

    // A flick's small turnarounds, like the bounce at the list's end, must not flip the toolbar.
    it('keeps the toolbar as it is on a short run', () => {
        expect(toolbarFolded(true, 200, -10, RUN)).toBe(true);
        expect(toolbarFolded(false, 200, 10, RUN)).toBe(false);
    });

    it('counts a run in one direction and starts over on turning around', () => {
        expect(scrollTravel(10, 5)).toBe(15);
        expect(scrollTravel(10, -5)).toBe(-5);
        expect(scrollTravel(0, 5)).toBe(5);
    });

    it('reads a detent as a fraction of the viewport or as pixels', () => {
        expect(snapHeight(0.5, 800)).toBe(400);
        expect(snapHeight('98px', 800)).toBe(98);
    });
});
