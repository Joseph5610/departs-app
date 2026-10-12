import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { SHEET } from '@/config/constants';
import { readSafeAreaTop } from '@/lib/safeArea';

type SnapPoint = number | string;

const { TAP_SLOP_PX } = SHEET;

/**
 * The popup is exactly the full height, so a drag past it meets resistance at once; the fill below it
 * reaches a screen down, so an overdrag never shows the map. Sticky headers inside paint the sheet's surface.
 */
const sheetStyle = (full: SnapPoint) => ({
    '--drawer-content-height': full,
    '--drawer-content-max-height': full,
    '--bleed': 'var(--app-height)',
    '--sticky-bg': 'var(--glass-fallback)',
}) as React.CSSProperties;

/** Each card, and the home, eases in when it replaces what the sheet showed. */
const CARD_ENTER = 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200';

/** The full height: the screen minus the status bar and a small gap, like the Maps app's large sheet. */
const fullHeight = (): SnapPoint => `${Math.round(window.innerHeight - Math.max(readSafeAreaTop(), SHEET.FULL_TOP_MIN_INSET_PX) - SHEET.FULL_TOP_GAP_PX)}px`;

type Detent = 'peek' | 'half' | 'full';

const DETENTS: Detent[] = ['peek', 'half', 'full'];

const atLeast = (detent: Detent, min: Detent): Detent => (DETENTS.indexOf(detent) >= DETENTS.indexOf(min) ? detent : min);
/** A detent's visible height in pixels. */
const heightOf = (point: SnapPoint): number =>
    typeof point === 'number' ? point * window.innerHeight : parseFloat(point);

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
    /** Each change collapses the sheet to its peek. */
    collapseRequest?: number;
    header: React.ReactNode;
    subHeader?: React.ReactNode;
    /** The card's content brings its own scroll container. */
    selfScrolling?: boolean;
    /** The home's fixed top row (search); in the header so a mouse can drag the sheet by it. */
    homeHeader?: React.ReactNode;
    /** The home content, told whether the sheet is at full height (the only height its list scrolls at). */
    home?: (isFull: boolean) => React.ReactNode;
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
export const MobileSheet = ({ isOpen, cardKey, minSnap, collapseRequest, header, subHeader, selfScrolling, homeHeader, home, floating, onDismiss, children }: MobileSheetProps) => {
    const { t } = useTranslation();

    // The heights by name, so the full height can follow the screen while the sheet keeps its place.
    const [full, setFull] = useState(fullHeight);
    useEffect(() => {
        const update = () => setFull(fullHeight());
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);
    const points = useMemo<Record<Detent, SnapPoint>>(() => ({ peek: SHEET.PEEK, half: SHEET.HALF, full }), [full]);
    const snapPoints = useMemo(() => DETENTS.map(d => points[d]), [points]);
    const style = useMemo(() => sheetStyle(full), [full]);

    // A card open from the first render (a shared stop link) starts at its own height; null while a swipe-close is undone.
    const [detent, setDetent] = useState<Detent | null>(() => (cardKey === null ? 'peek' : minSnap));
    const swipeCloseFromRef = useRef<Detent>('peek');
    const swipeCloseHeightRef = useRef(0);
    const swipeCollapseRef = useRef(false);

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
            setDetent(atLeast(current, minSnap));
        }
    }

    const [prevCollapseRequest, setPrevCollapseRequest] = useState(collapseRequest);
    if (collapseRequest !== prevCollapseRequest) {
        setPrevCollapseRequest(collapseRequest);
        setDetent('peek');
        setHomeDetent('peek');
    }

    const isFull = detent === 'full';

    const cycleDetent = () => setDetent(DETENTS[(DETENTS.indexOf(detent ?? 'peek') + 1) % DETENTS.length]);

    return (
        <>
            <div
                aria-hidden="true"
                className={cn("pointer-events-none fixed inset-0 z-499 bg-black/40 transition-opacity duration-300", isFull ? "opacity-100" : "opacity-0")}
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
                            const popup = document.querySelector('[data-slot="drawer-popup"]');
                            swipeCloseHeightRef.current = popup ? window.innerHeight - popup.getBoundingClientRect().top : 0;
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
                    setDetent(DETENTS.find(d => points[d] === point) ?? 'peek');
                }}
                modal={false}
                disablePointerDismissal={true}
            >
                <DrawerContent
                    variant="glassy"
                    className="outline-none text-foreground"
                    style={style}
                    initialFocus={false}
                    aria-describedby={undefined}
                    data-testid={isOpen ? 'detail-panel' : 'home-sheet'}
                    // Content below full height does not scroll, so a mouse wheel or trackpad raises the sheet instead.
                    onWheel={(e) => { if (!isFull && e.deltaY > 0) setDetent('full'); }}
                    header={
                        <div className="relative shrink-0 flex flex-col">
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
                                className="flex h-7 w-full shrink-0 cursor-grab items-center justify-center rounded-t-[32px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
                                data-testid="home-sheet-grabber"
                            >
                                <span className="h-1.5 w-10 rounded-full bg-border" />
                            </div>
                            {isOpen ? (
                                <div key={cardKey} className={CARD_ENTER}>
                                    <div className="px-6 pb-2">{header}</div>
                                    {subHeader && <div className="w-full">{subHeader}</div>}
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
                    {!isOpen ? (
                        <div key="home" className={cn("flex flex-1 min-h-0 flex-col", CARD_ENTER)}>{home?.(isFull)}</div>
                    ) : selfScrolling ? (
                        <div key={cardKey} className={cn("flex flex-1 min-h-0 flex-col", CARD_ENTER)}>{children}</div>
                    ) : (
                        <div key={cardKey} className={cn("flex-1 min-h-0 px-6 overscroll-contain", isFull ? "overflow-y-auto" : "overflow-hidden", CARD_ENTER)}>
                            <div className="pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">{children}</div>
                        </div>
                    )}
                </DrawerContent>
            </Drawer>
        </>
    );
};
