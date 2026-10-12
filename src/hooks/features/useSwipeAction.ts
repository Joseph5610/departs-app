import type React from 'react';
import { useEffect, useRef } from 'react';
import { DEPARTURES_CONFIG } from '@/config/constants';

/** Whether a drag this far from its start is, or may still become, the row's left swipe. */
const leansLeft = (dx: number, dy: number) => dx <= 0 && -dx >= Math.abs(dy) * 1.5;

type Gesture = { id: number; x: number; y: number; offset: number; phase: 'pending' | 'swiping'; done: AbortController };

/**
 * A row's left swipe (touch) or right click (mouse) that runs `onTrigger`. The swipe moves the element in
 * `contentRef` without re-rendering and sets `--swipe` (0–1) and `data-armed` on the element the handlers go on,
 * so its revealed action can follow; a mostly vertical drag is left to scrolling and the sheet.
 */
export const useSwipeAction = (onTrigger: (() => void) | undefined) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const gesture = useRef<Gesture | null>(null);
    const release = () => {
        gesture.current?.done.abort();
        gesture.current = null;
    };
    const hasAction = !!onTrigger;
    useEffect(() => () => {
        gesture.current?.done.abort();
        gesture.current = null;
    }, [hasAction]);

    const show = (host: HTMLElement, offset: number, animate: boolean) => {
        const content = contentRef.current;
        if (!content) return;
        content.style.transition = animate ? 'transform 200ms ease-out' : '';
        content.style.transform = offset ? `translateX(${offset}px)` : '';
        host.style.setProperty('--swipe', String(Math.min(1, -offset / DEPARTURES_CONFIG.SWIPE_ACTION_PX)));
        host.toggleAttribute('data-armed', -offset >= DEPARTURES_CONFIG.SWIPE_ACTION_PX);
    };

    const end = (e: React.PointerEvent<HTMLElement>, commit: boolean) => {
        const g = gesture.current;
        if (!g || g.id !== e.pointerId) return;
        release();
        if (g.phase !== 'swiping') return;
        if (commit && -g.offset >= DEPARTURES_CONFIG.SWIPE_ACTION_PX) onTrigger?.();
        show(e.currentTarget, 0, true);
    };

    if (!onTrigger) return { contentRef, handlers: {} };

    return {
        contentRef,
        handlers: {
            onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
                if (e.pointerType === 'mouse' || gesture.current) return;
                const g: Gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, offset: 0, phase: 'pending', done: new AbortController() };
                gesture.current = g;
                // The sheet drags itself from a capturing document touchmove; one on the window runs first and keeps a sideways swipe from it.
                window.addEventListener('touchmove', (touch) => {
                    const t = touch.touches[0];
                    if (touch.touches.length !== 1 || (g.phase === 'pending' && !leansLeft(t.clientX - g.x, t.clientY - g.y))) return;
                    touch.stopPropagation();
                    if (g.phase === 'swiping' && touch.cancelable) touch.preventDefault();
                }, { capture: true, passive: false, signal: g.done.signal });
                // A pending drag lifted over another element never sends this row its pointerup.
                window.addEventListener('touchend', (touch) => {
                    if (touch.touches.length === 0 && gesture.current === g && g.phase === 'pending') release();
                }, { capture: true, signal: g.done.signal });
            },
            onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
                const g = gesture.current;
                if (!g || g.id !== e.pointerId) return;
                const dx = e.clientX - g.x;
                const dy = e.clientY - g.y;
                if (g.phase === 'pending') {
                    if (Math.max(Math.abs(dy), dx) > DEPARTURES_CONFIG.TAP_SLOP_PX && !leansLeft(dx, dy)) { release(); return; }
                    if (dx > -DEPARTURES_CONFIG.TAP_SLOP_PX || !leansLeft(dx, dy)) return;
                    g.phase = 'swiping';
                    e.currentTarget.setPointerCapture(e.pointerId);
                }
                g.offset = Math.max(-DEPARTURES_CONFIG.SWIPE_MAX_PX, Math.min(0, dx));
                show(e.currentTarget, g.offset, false);
            },
            onPointerUp: (e: React.PointerEvent<HTMLElement>) => end(e, true),
            onPointerCancel: (e: React.PointerEvent<HTMLElement>) => end(e, false),
            onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
                e.preventDefault();
                onTrigger();
            },
        },
    };
};
