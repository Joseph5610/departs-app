import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { SHEET } from '@/config/constants';
import { sheetContentOpacity, sheetControlsOpacity, sheetMorph, snapHeight, type SnapPoint } from '@/lib/sheetMorph';

interface SheetMorphParts {
    popup: RefObject<HTMLElement | null>;
    header: RefObject<HTMLElement | null>;
    scrim: RefObject<HTMLElement | null>;
    content: RefObject<HTMLElement | null>;
    toolbar: RefObject<HTMLElement | null>;
}

/**
 * Follows the sheet's real height outside React and turns the one sheet from the peek capsule into the
 * full-width sheet. The loop runs only while a gesture on the sheet or a detent change can move it.
 */
export const useSheetMorph = ({ popup, header, scrim, content, toolbar }: SheetMorphParts, points: Record<'peek' | 'half' | 'full', SnapPoint>, wakeKey: unknown) => {
    const pointsRef = useRef(points);
    const wakeRef = useRef<() => void>(() => undefined);

    useEffect(() => {
        pointsRef.current = points;
    });

    useEffect(() => {
        let frame = 0;
        let idle = 0;
        let last = Number.NaN;
        let onSheet = false;

        const apply = (el: HTMLElement, height: number) => {
            const hidden = Math.max(0, el.offsetHeight - height);
            const viewport = window.innerHeight;
            const { peek, half, full } = pointsRef.current;
            const peekHeight = snapHeight(peek, viewport);
            const { morph, rise } = sheetMorph(height, { peek: peekHeight, half: snapHeight(half, viewport), full: snapHeight(full, viewport) });

            const glass = el.querySelector<HTMLElement>('[data-slot="drawer-glass"]');
            if (glass) {
                const gap = peekHeight - SHEET.PEEK_CONTENT_PX;
                glass.style.setProperty('--sheet-morph', String(morph));
                glass.style.setProperty('--sheet-glass-height', morph < 1 ? `${Math.max(height, peekHeight) - gap * (1 - morph)}px` : '100%');
                glass.toggleAttribute('data-solid', rise >= SHEET.SOLID_FROM_RISE);
                glass.toggleAttribute('data-edge-top', morph >= 1);
            }
            header.current?.style.setProperty('--sheet-morph', String(morph));
            header.current?.style.setProperty('--sheet-controls-opacity', String(sheetControlsOpacity(rise)));
            if (scrim.current) scrim.current.style.opacity = String(rise);
            content.current?.style.setProperty('--sheet-hidden', `${hidden}px`);
            const opacity = String(sheetContentOpacity(morph));
            const visibility = opacity === '0' ? 'hidden' : 'visible';
            // On the header, so a sub-header mounting later (a card's data arriving) picks them up without a sheet move.
            header.current?.style.setProperty('--sheet-content-opacity', opacity);
            header.current?.style.setProperty('--sheet-content-visibility', visibility);
            for (const part of [content, toolbar]) {
                if (!part.current) continue;
                part.current.style.opacity = opacity;
                part.current.style.visibility = visibility;
            }
        };

        const tick = () => {
            frame = 0;
            const el = popup.current;
            if (el) {
                const height = window.innerHeight - el.getBoundingClientRect().top;
                if (height === last) {
                    idle += 1;
                } else {
                    idle = 0;
                    last = height;
                    apply(el, height);
                }
            }
            if (idle < SHEET.MORPH_IDLE_FRAMES) frame = requestAnimationFrame(tick);
        };

        const wake = () => {
            idle = 0;
            if (!frame) frame = requestAnimationFrame(tick);
        };
        wakeRef.current = wake;
        wake();

        const startsOnSheet = (e: Event) => {
            onSheet = e.target instanceof Node && !!popup.current?.contains(e.target);
            if (onSheet) wake();
        };
        const whileOnSheet = () => {
            if (onSheet) wake();
        };
        const release = () => {
            if (onSheet) wake();
            onSheet = false;
        };
        window.addEventListener('pointerdown', startsOnSheet, { passive: true });
        window.addEventListener('wheel', startsOnSheet, { passive: true });
        window.addEventListener('pointermove', whileOnSheet, { passive: true });
        window.addEventListener('touchmove', whileOnSheet, { passive: true });
        window.addEventListener('pointerup', release, { passive: true });
        window.addEventListener('pointercancel', release, { passive: true });
        window.addEventListener('resize', wake, { passive: true });
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('pointerdown', startsOnSheet);
            window.removeEventListener('wheel', startsOnSheet);
            window.removeEventListener('pointermove', whileOnSheet);
            window.removeEventListener('touchmove', whileOnSheet);
            window.removeEventListener('pointerup', release);
            window.removeEventListener('pointercancel', release);
            window.removeEventListener('resize', wake);
        };
    }, [popup, header, scrim, content, toolbar]);

    useEffect(() => wakeRef.current(), [wakeKey, points]);
};
