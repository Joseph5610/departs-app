import { SHEET } from '@/config/constants';

export type SnapPoint = number | string;

/** A detent's visible height in pixels: a fraction of the viewport, or a pixel string. */
export const snapHeight = (point: SnapPoint, viewportHeight: number): number =>
    typeof point === 'number' ? point * viewportHeight : parseFloat(point);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface SheetHeights { peek: number; half: number; full: number }

/** How far a sheet of a visible height has turned: `morph` runs from the peek capsule to half, `rise` from half to full. */
export const sheetMorph = (height: number, { peek, half, full }: SheetHeights) => ({
    morph: clamp01((height - peek) / (half - peek)),
    rise: clamp01((height - half) / (full - half)),
});

/** How far a scroll has run in one direction: down is positive, and turning around starts over. */
export const scrollTravel = (travel: number, delta: number) => (Math.sign(travel) === Math.sign(delta) ? travel + delta : delta);

/** A scrolled list folds its toolbar on a run down and restores it on a run up or at its start; a shorter run keeps the state. */
export const toolbarFolded = (folded: boolean, scrollTop: number, travel: number, { startPx, runPx }: { startPx: number; runPx: number }) => {
    if (scrollTop <= startPx) return false;
    if (Math.abs(travel) < runPx) return folded;
    return travel > 0;
};

/** The content fades in over the middle of the morph, so nothing shows under the capsule at the peek. */
export const sheetContentOpacity = (morph: number) =>
    clamp01((morph - SHEET.CONTENT_FADE_FROM_MORPH) / SHEET.CONTENT_FADE_SPAN_MORPH);

/** The controls riding above the sheet are gone early on the way from half to full. */
export const sheetControlsOpacity = (rise: number) => clamp01(1 - rise / SHEET.CONTROLS_GONE_AT_RISE);

/** How far the peek capsule floats above the screen's bottom: over the home indicator where there is one. */
export const peekGapPx = (safeAreaBottom: number) =>
    Math.max(SHEET.PEEK_BOTTOM_PX, safeAreaBottom - SHEET.PEEK_HOME_INDICATOR_OVERLAP_PX);
