import type React from 'react';
import { useEffect, useRef } from 'react';
import { DEPARTURES_CONFIG } from '@/config/constants';

/** Whether a drag this far from its start is, or may still become, a sideways swipe. */
const leansSideways = (dx: number, dy: number) => Math.abs(dx) >= Math.abs(dy) * 1.5;

type Gesture = { id: number; x: number; y: number; offset: number; dir: -1 | 1 | 0; phase: 'pending' | 'swiping'; done: AbortController };

/**
 * A row's sideways swipe (touch): left runs `onLeft`, right runs `onRight`. The swipe moves the element in
 * `contentRef` without re-rendering and sets `--swipe-left` / `--swipe-right` (0–1) and `data-armed` on the element
 * the handlers go on, so the revealed action can follow; a mostly vertical drag is left to scrolling and the sheet.
 */
export const useSwipeAction = (onLeft: (() => void) | undefined, onRight?: () => void) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const gesture = useRef<Gesture | null>(null);
    const release = () => {
        gesture.current?.done.abort();
        gesture.current = null;
    };
    const hasAction = !!onLeft || !!onRight;
    useEffect(() => () => {
        gesture.current?.done.abort();
        gesture.current = null;
    }, [hasAction]);

    /** Whether a drag of `dx` heads towards an action this row has. */
    const allows = (dx: number) => (dx < 0 ? !!onLeft : dx > 0 ? !!onRight : true);

    const show = (host: HTMLElement, offset: number, animate: boolean) => {
        const content = contentRef.current;
        if (!content) return;
        content.style.transition = animate ? 'transform 200ms ease-out' : '';
        content.style.transform = offset ? `translateX(${offset}px)` : '';
        const progress = String(Math.min(1, Math.abs(offset) / DEPARTURES_CONFIG.SWIPE_ACTION_PX));
        host.style.setProperty('--swipe-left', offset < 0 ? progress : '0');
        host.style.setProperty('--swipe-right', offset > 0 ? progress : '0');
        host.toggleAttribute('data-armed', Math.abs(offset) >= DEPARTURES_CONFIG.SWIPE_ACTION_PX);
    };

    const end = (e: React.PointerEvent<HTMLElement>, commit: boolean) => {
        const g = gesture.current;
        if (!g || g.id !== e.pointerId) return;
        release();
        if (g.phase !== 'swiping') return;
        if (commit && Math.abs(g.offset) >= DEPARTURES_CONFIG.SWIPE_ACTION_PX) (g.dir < 0 ? onLeft : onRight)?.();
        show(e.currentTarget, 0, true);
    };

    if (!hasAction) return { contentRef, handlers: {} };

    return {
        contentRef,
        handlers: {
            onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
                if (e.pointerType === 'mouse' || gesture.current) return;
                const g: Gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, offset: 0, dir: 0, phase: 'pending', done: new AbortController() };
                gesture.current = g;
                // The sheet drags itself from a capturing document touchmove; one on the window runs first and keeps a sideways swipe from it.
                window.addEventListener('touchmove', (touch) => {
                    const t = touch.touches[0];
                    const dx = t.clientX - g.x;
                    if (touch.touches.length !== 1 || (g.phase === 'pending' && (!leansSideways(dx, t.clientY - g.y) || !allows(dx)))) return;
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
                    if (Math.max(Math.abs(dx), Math.abs(dy)) <= DEPARTURES_CONFIG.TAP_SLOP_PX) return;
                    if (!leansSideways(dx, dy) || !allows(dx)) { release(); return; }
                    g.phase = 'swiping';
                    g.dir = dx < 0 ? -1 : 1;
                    e.currentTarget.setPointerCapture(e.pointerId);
                }
                g.offset = g.dir < 0
                    ? Math.max(-DEPARTURES_CONFIG.SWIPE_MAX_PX, Math.min(0, dx))
                    : Math.min(DEPARTURES_CONFIG.SWIPE_MAX_PX, Math.max(0, dx));
                show(e.currentTarget, g.offset, false);
            },
            onPointerUp: (e: React.PointerEvent<HTMLElement>) => end(e, true),
            onPointerCancel: (e: React.PointerEvent<HTMLElement>) => end(e, false),
        },
    };
};
