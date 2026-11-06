import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { SHEET } from '@/config/constants';
import { readSafeArea } from '@/lib/safeArea';
import { peekGapPx, snapHeight, type SnapPoint } from '@/lib/sheetMorph';
import { useSheetMorph } from '@/hooks/features/useSheetMorph';
import { useToolbarFold } from '@/hooks/features/useToolbarFold';

const { TAP_SLOP_PX } = SHEET;

/**
 * The popup is exactly the full height, so a drag past it meets resistance at once; the fill below it
 * reaches a screen down, so an overdrag never shows the map.
 */
const sheetStyle = (full: SnapPoint, peek: SnapPoint, startsAtPeek: boolean, height: number | null) => ({
    // Base UI measures its offset a frame after the popup resizes, which would flick the sheet up; a resting sheet takes it from the detent.
    ...(height !== null && { '--drawer-y': `calc(${full} - ${height}px + var(--drawer-swipe-movement-y))` }),
    // The sheet's shape for its first frame, before useSheetMorph has measured it.
    '--sheet-morph': startsAtPeek ? 0 : 1,
    '--sheet-glass-height': startsAtPeek ? `${SHEET.PEEK_CONTENT_PX}px` : '100%',
    // Below the peek's offset a drag only resists, then stops; Base UI brings the sheet back on release.
    '--peek-y': `calc(${full} - ${peek})`,
    '--translate-y': `min(var(--drawer-y), calc(var(--peek-y) + (var(--drawer-y) - var(--peek-y)) * ${SHEET.OVERDRAG_RATE}), calc(var(--peek-y) + ${SHEET.OVERDRAG_MAX_PX}px))`,
    '--drawer-content-height': full,
    '--drawer-content-max-height': full,
    '--bleed': 'var(--app-height)',
    '--panel-gutter': '1rem',
}) as React.CSSProperties;

/** The header's and the card's natural height together while `active`, null otherwise; follows the card as it grows. */
const useFitHeight = (active: boolean, header: React.RefObject<HTMLDivElement | null>, card: React.RefObject<HTMLDivElement | null>, cardKey: string | null) => {
    const [height, setHeight] = useState<number | null>(null);
    useLayoutEffect(() => {
        const headerEl = header.current, cardEl = card.current;
        if (!active || !headerEl || !cardEl) return;
        // A ResizeObserver reports each element once on observe, which takes the first measure.
        const observer = new ResizeObserver(() => setHeight(Math.ceil(headerEl.offsetHeight + cardEl.scrollHeight)));
        observer.observe(headerEl);
        observer.observe(cardEl);
        return () => observer.disconnect();
    }, [active, header, card, cardKey]);
    return active ? height : null;
};

/** Each card, and the home, eases in when it replaces what the sheet showed. */
const CARD_ENTER = 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200';

interface Heights { peek: SnapPoint; full: SnapPoint }

/**
 * The peek is the floating capsule plus the gap under it; the full height is the screen minus the status
 * bar and a small gap, like the Maps app's large sheet.
 */
const bottomInset = () => Math.max(
    readSafeArea('bottom'),
    document.documentElement.classList.contains('standalone') ? SHEET.STANDALONE_BOTTOM_INSET_PX : 0,
);

const measureHeights = (): Heights => ({
    peek: `${SHEET.PEEK_CONTENT_PX + peekGapPx(bottomInset())}px`,
    full: `${Math.round(window.innerHeight - Math.max(readSafeArea('top'), SHEET.FULL_TOP_MIN_INSET_PX) - SHEET.FULL_TOP_GAP_PX)}px`,
});

const sameHeights = (a: Heights, b: Heights) => a.peek === b.peek && a.full === b.full;

/** Whether a touch starts in the home indicator's strip, where iOS's swipe home begins. */
const inHomeIndicator = (clientY: number) => clientY > window.innerHeight - readSafeArea('bottom');

type Detent = 'peek' | 'half' | 'full';

const DETENTS: Detent[] = ['peek', 'half', 'full'];

const atLeast = (detent: Detent, min: Detent): Detent => (DETENTS.indexOf(detent) >= DETENTS.indexOf(min) ? detent : min);
const heightOf = (point: SnapPoint): number => snapHeight(point, window.innerHeight);

/**
 * Where a flick down from `from` lands: the lower detent nearest the sheet's height at release, so a
 * short flick steps down one detent and a long one carries on; never `from` itself.
 */
const landingBelow = (from: Detent, releasedHeight: number, points: Record<Detent, SnapPoint>): Detent => {
    const lower = DETENTS.slice(0, Math.max(1, DETENTS.indexOf(from)));
    return lower.reduce((best, d) => (Math.abs(heightOf(points[d]) - releasedHeight) < Math.abs(heightOf(points[best]) - releasedHeight) ? d : best), lower[lower.length - 1]);
};

interface MobileSheetProps {
    /** Whether a card (stop, trip, settings...) is shown instead of the home content. */
    isOpen: boolean;
    /** Identifies the open card; a new one lifts the sheet to `minSnap`. */
    cardKey: string | null;
    /** The height a newly opened card needs at least. */
    minSnap: 'half' | 'full';
    /** The card's middle height is its content's own, and it opens there however high the sheet stood. */
    fitsContent?: boolean;
    /** Each change collapses the sheet to its peek. */
    collapseRequest?: number;
    header: React.ReactNode;
    subHeader?: React.ReactNode;
    /** The card's content brings its own scroll container. */
    selfScrolling?: boolean;
    /** The home's fixed top row (search); in the header so a mouse can drag the sheet by it. */
    homeHeader?: React.ReactNode;
    /** The card's bottom toolbar, told whether scrolling folded it. */
    toolbar?: (collapsed: boolean) => React.ReactNode;
    /** The home content, told whether the sheet is at full height (the only height its list scrolls at) and at its peek (where none of it shows). */
    home?: (isFull: boolean, isPeek: boolean) => React.ReactNode;
    /** Rides above the sheet's top edge, hidden at full height. */
    floating?: (hidden: boolean) => React.ReactNode;
    onDismiss: () => void;
    children: React.ReactNode;
}

/**
 * The one mobile sheet: the home content, or a card pushed over it, at three fixed heights.
 * Only the user moves it, except that opening a card lifts it to the card's minimum height and closing
 * the card puts back the home's own height (the bottom, when the card was swiped away).
 * Content scrolls only at full height, so at the lower heights every vertical drag moves the sheet
 * and scrolling down with a wheel raises it to full.
 */
export const MobileSheet = ({ isOpen, cardKey, minSnap, fitsContent = false, collapseRequest, header, subHeader, selfScrolling, homeHeader, toolbar, home, floating, onDismiss, children }: MobileSheetProps) => {
    const { t } = useTranslation();

    // The heights by name, so they can follow the screen while the sheet keeps its place.
    // Base UI keeps a stale height if the popup regrows before its shrink renders (iOS resume), so follow the screen only once it settles.
    const popupRef = useRef<HTMLDivElement>(null);
    const [heights, setHeights] = useState(measureHeights);
    // A screen change (the safe area arriving, the browser's bars) moves the detents; the sheet follows at once, without sliding.
    useLayoutEffect(() => {
        const popup = popupRef.current;
        if (!popup) return;
        popup.style.transition = 'none';
        const frame = requestAnimationFrame(() => requestAnimationFrame(() => { popup.style.transition = ''; }));
        return () => cancelAnimationFrame(frame);
    }, [heights]);
    useEffect(() => {
        let timer: number | undefined;
        const update = () => {
            window.clearTimeout(timer);
            if (document.visibilityState === 'hidden') return;
            timer = window.setTimeout(() => {
                const next = measureHeights();
                setHeights(prev => (sameHeights(prev, next) ? prev : next));
            }, SHEET.RESIZE_SETTLE_MS);
        };
        window.addEventListener('resize', update);
        document.addEventListener('visibilitychange', update);
        update();
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('resize', update);
            document.removeEventListener('visibilitychange', update);
        };
    }, []);
    useEffect(() => {
        document.documentElement.style.setProperty('--sheet-peek', String(heights.peek));
    }, [heights.peek]);
    const headerRef = useRef<HTMLDivElement>(null);
    const fitRef = useRef<HTMLDivElement>(null);
    const fitHeight = useFitHeight(fitsContent && isOpen, headerRef, fitRef, cardKey);
    const points = useMemo<Record<Detent, SnapPoint>>(() => ({
        peek: heights.peek,
        half: fitHeight === null ? SHEET.HALF : `${Math.min(fitHeight, heightOf(heights.full))}px`,
        full: heights.full,
    }), [heights, fitHeight]);
    const snapPoints = useMemo(() => DETENTS.map(d => points[d]), [points]);
    const [startsAtPeek] = useState(cardKey === null);

    // A card open from the first render (a shared stop link) starts at its own height; null while a swipe-close is undone.
    const [detent, setDetent] = useState<Detent | null>(() => (cardKey === null ? 'peek' : minSnap));
    const swipeCloseFromRef = useRef<Detent>('peek');
    const swipeCloseHeightRef = useRef(0);
    const swipeCollapseRef = useRef(false);

    // The iOS swipe home starts on the sheet and drags it up first, so a drag the app is hidden right after is undone.
    const lastDragRef = useRef<{ from: Detent; at: number } | null>(null);
    useEffect(() => {
        const onVisibilityChange = () => {
            const drag = lastDragRef.current;
            lastDragRef.current = null;
            if (document.visibilityState === 'hidden' && drag && performance.now() - drag.at < SHEET.HOME_GESTURE_UNDO_MS) setDetent(drag.from);
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    // The home keeps its own height: a card opens at least at `minSnap` and leaving it restores the home's.
    const [homeDetent, setHomeDetent] = useState<Detent>('peek');
    const [prevCardKey, setPrevCardKey] = useState(cardKey);
    if (cardKey !== prevCardKey) {
        setPrevCardKey(cardKey);
        const current = detent ?? 'peek';
        if (cardKey === null) {
            setDetent(homeDetent);
        } else {
            if (prevCardKey === null) setHomeDetent(current);
            setDetent(fitsContent ? 'half' : atLeast(current, minSnap));
        }
    }

    const [prevCollapseRequest, setPrevCollapseRequest] = useState(collapseRequest);
    if (collapseRequest !== prevCollapseRequest) {
        setPrevCollapseRequest(collapseRequest);
        setDetent('peek');
        setHomeDetent('peek');
    }

    const isFull = detent === 'full';
    const restingHeight = detent ? heightOf(points[detent]) : null;
    const style = useMemo(() => sheetStyle(heights.full, heights.peek, startsAtPeek, restingHeight), [heights.full, heights.peek, startsAtPeek, restingHeight]);

    const scrimRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    useSheetMorph({ popup: popupRef, header: headerRef, scrim: scrimRef, content: contentRef, toolbar: toolbarRef }, points, detent);

    const { folded: isToolbarFolded, onScroll: onCardScroll } = useToolbarFold(`${cardKey}|${isFull}`);

    const cycleDetent = () => setDetent(DETENTS[(DETENTS.indexOf(detent ?? 'peek') + 1) % DETENTS.length]);

    return (
        <>
            <div
                ref={scrimRef}
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-499 bg-black/25 opacity-0"
            />
            <Drawer
                open={true}
                onOpenChange={(open, details) => {
                    if (open) return;
                    details.cancel();
                    if (details.reason === 'swipe') swipeCollapseRef.current = true;
                    else if (details.reason === 'escape-key' && isOpen) onDismiss();
                }}
                snapPoints={snapPoints}
                snapPoint={detent ? points[detent] : null}
                onSnapPointChange={(point, details) => {
                    // A flick down reads as a swipe-close; the sheet lands on the nearest lower height instead.
                    if (point === null) {
                        if (details.reason === 'swipe') {
                            swipeCloseFromRef.current = detent ?? 'peek';
                            // The popup still sits where the finger left it.
                            swipeCloseHeightRef.current = popupRef.current ? window.innerHeight - popupRef.current.getBoundingClientRect().top : 0;
                        }
                        setDetent(null);
                        return;
                    }
                    // A canceled swipe-close restores the previous snap point right after onOpenChange.
                    if (swipeCollapseRef.current) {
                        swipeCollapseRef.current = false;
                        const from = swipeCloseFromRef.current;
                        setDetent(from === 'peek' ? 'peek' : landingBelow(from, swipeCloseHeightRef.current, points));
                        // Swiped away, the card leaves the home at the bottom too.
                        if (from === 'peek' && isOpen) {
                            setHomeDetent('peek');
                            onDismiss();
                        }
                        return;
                    }
                    if (detent) lastDragRef.current = { from: detent, at: performance.now() };
                    setDetent(DETENTS.find(d => points[d] === point) ?? 'peek');
                }}
                modal={false}
                disablePointerDismissal={true}
            >
                <DrawerContent
                    ref={popupRef}
                    variant="glassy"
                    glassClassName="sheet-glass"
                    className="outline-none text-foreground"
                    style={style}
                    initialFocus={false}
                    aria-describedby={undefined}
                    data-testid={isOpen ? 'detail-panel' : 'home-sheet'}
                    // Base UI starts its drag from the viewport's handlers; stopping here leaves the swipe home to iOS.
                    onPointerDown={(e) => { if (e.pointerType === 'touch' && inHomeIndicator(e.clientY)) e.stopPropagation(); }}
                    onTouchStart={(e) => { if (inHomeIndicator(e.touches[0].clientY)) e.stopPropagation(); }}
                    // Content below full height does not scroll, so a mouse wheel or trackpad raises the sheet instead.
                    onWheel={(e) => { if (!isFull && e.deltaY > 0) setDetent('full'); }}
                    header={
                        <div ref={headerRef} className="relative shrink-0 flex flex-col">
                            {floating?.(isFull)}
                            {/* Not a <button>: Base UI never starts a mouse drag on one, and this is the handle a mouse drags by. */}
                            <div
                                role="separator"
                                aria-orientation="horizontal"
                                tabIndex={0}
                                // The drag handling captures the pointer and swallows the click; a tap is a release where it went down.
                                onPointerDown={(e) => {
                                    const { clientX, clientY } = e;
                                    const done = new AbortController();
                                    window.addEventListener('pointerup', (up) => {
                                        done.abort();
                                        if (Math.hypot(up.clientX - clientX, up.clientY - clientY) < TAP_SLOP_PX) cycleDetent();
                                    }, { signal: done.signal });
                                    window.addEventListener('pointercancel', () => done.abort(), { signal: done.signal });
                                }}
                                onKeyDown={(e) => {
                                    if (e.key !== 'Enter' && e.key !== ' ') return;
                                    e.preventDefault();
                                    cycleDetent();
                                }}
                                aria-label={t('home.resizeSheet')}
                                className="relative flex h-[calc(0.75rem+0.25rem*var(--sheet-morph,1))] w-full shrink-0 cursor-grab items-center justify-center rounded-t-sheet outline-none before:absolute before:inset-x-1/4 before:-top-7 before:bottom-0 focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
                                data-testid="home-sheet-grabber"
                            >
                                <span className="h-1 w-9 rounded-full bg-handle" />
                            </div>
                            {isOpen ? (
                                <div key={cardKey} className={CARD_ENTER}>
                                    <div className="sheet-row-gutter">{header}</div>
                                    {subHeader && <div className="w-full opacity-(--sheet-content-opacity,1) [visibility:var(--sheet-content-visibility,visible)]">{subHeader}</div>}
                                </div>
                            ) : (
                                <>
                                    <DrawerTitle className="sr-only">{t('search.placeholder')}</DrawerTitle>
                                    {homeHeader}
                                </>
                            )}
                        </div>
                    }
                >
                    <div ref={contentRef} className="flex flex-1 min-h-0 flex-col">
                        {!isOpen ? (
                            <div key="home" className={cn("flex flex-1 min-h-0 flex-col", CARD_ENTER)}>{home?.(isFull, detent === 'peek')}</div>
                        ) : selfScrolling ? (
                            <div key={cardKey} ref={fitRef} className={cn("flex min-h-0 flex-col", fitsContent ? "shrink" : "flex-1", CARD_ENTER)}>{children}</div>
                        ) : (
                            <div
                                key={cardKey}
                                onScroll={toolbar ? onCardScroll : undefined}
                                data-panel-scroller
                                className={cn("flex-1 min-h-0 px-(--panel-gutter) overscroll-contain", isFull ? "overflow-y-auto" : "overflow-hidden", toolbar && "scroll-edge", CARD_ENTER)}
                            >
                                <div className={toolbar ? "pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]" : "pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"}>{children}</div>
                            </div>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
            <div ref={toolbarRef} className="relative z-501">{isOpen && toolbar?.(isFull && isToolbarFolded)}</div>
        </>
    );
};
