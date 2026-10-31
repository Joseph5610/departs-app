import type React from 'react';
import { cn } from '@/lib/cn';
import { Route, Star } from 'lucide-react';
import { splitLastWord, wrappableName } from '@/lib/strings';
import { useSwipeAction } from '@/hooks/features/useSwipeAction';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';

/** A board list's entry; a line's further direction follows the one above closely. */
export const BoardSection = ({ continuesLine = false, children }: { continuesLine?: boolean; children: React.ReactNode }) => (
    <section className={cn(continuesLine && "-mt-3")}>{children}</section>
);

/** What swiping a row (left: pin, right: take the trip), or picking it from the row's right-click menu, does. */
export interface RowAction {
    onTrigger: () => void;
    /** The action's name in the right-click menu. */
    label: string;
    /** Its short name on the block a swipe reveals. */
    swipeLabel: string;
    /** The action undoes itself, e.g. the line is already pinned; its revealed star shows filled. */
    isActive: boolean;
}

interface BoardRowProps extends React.HTMLAttributes<HTMLDivElement> {
    action?: RowAction;
    /** The user's trip: a swipe to the right, and the menu's second item. */
    tripAction?: RowAction;
    /** Content under the row in the headsign column, e.g. the later departures. */
    below?: React.ReactNode;
}

/**
 * The board's row grid: badge, headsign and time columns. `children` are the lead row's cells (badge,
 * headsign, countdown, then time line, amenities and notes); the element holding them, which gets the other
 * props, shares the grid's tracks, so `below` aligns to its cells. With an `action`, the row slides left
 * under a swipe to reveal a star block and runs it past the threshold, with a `tripAction` it slides right to
 * reveal a route block; a right click offers both in a menu.
 */
export const BoardRow = ({ action, tripAction, ...props }: BoardRowProps) => {
    if (!action && !tripAction) return <RowBody {...props} />;
    return (
        <ContextMenu>
            <ContextMenuTrigger
                // Touch has the swipe; a long press stays a tap's start rather than opening the menu.
                onTouchStart={(e) => e.preventBaseUIHandler()}
                render={(trigger) => <RowBody action={action} tripAction={tripAction} outer={trigger} {...props} />}
            />
            <ContextMenuContent>
                {action && (
                    <ContextMenuItem onClick={action.onTrigger}>
                        <Star strokeWidth={1.75} className="text-favorite" fill={action.isActive ? 'currentColor' : 'none'} />
                        {action.label}
                    </ContextMenuItem>
                )}
                {tripAction && (
                    <ContextMenuItem onClick={tripAction.onTrigger}>
                        <Route strokeWidth={1.75} className="text-primary" />
                        {tripAction.label}
                    </ContextMenuItem>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
};

const SWIPE_ICON = 'shrink-0 transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] group-data-armed/row:scale-115';

/** The action a swipe reveals beside the row, growing with it: tinted, then solid once letting go runs it. */
const SwipeBlock = ({ label, className, children }: { label: string; className: string; children: React.ReactNode }) => (
    <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-y-2 flex flex-col items-center justify-center gap-0.75 overflow-hidden rounded-surface [transition:var(--swipe-block-transition,none),background-color_150ms,color_150ms]", className)}
    >
        {children}
        <span className="whitespace-nowrap text-caption leading-3.25 font-semibold opacity-0 group-data-swipe-label/row:opacity-100">{label}</span>
    </span>
);

/** The row itself; `outer` are the context menu trigger's props, which go on the element under the pointer. */
const RowBody = ({ action, tripAction, below, className, children, outer, ...lead }: BoardRowProps & { outer?: React.ComponentProps<'div'> }) => {
    const { contentRef, handlers } = useSwipeAction(action?.onTrigger, tripAction?.onTrigger);
    return (
        <div {...outer} {...handlers} className="group/row relative touch-pan-y">
            {action && (
                <SwipeBlock label={action.swipeLabel} className="right-0 w-(--swipe-left,0px) bg-favorite/22 text-favorite group-data-armed/row:bg-favorite group-data-armed/row:text-on-favorite">
                    <Star size={20} strokeWidth={2} fill="currentColor" className={SWIPE_ICON} />
                </SwipeBlock>
            )}
            {tripAction && (
                <SwipeBlock label={tripAction.swipeLabel} className="left-0 w-(--swipe-right,0px) bg-primary/22 text-tint-mint group-data-armed/row:bg-primary group-data-armed/row:text-primary-foreground">
                    <Route size={20} strokeWidth={2.25} className={SWIPE_ICON} />
                </SwipeBlock>
            )}
            <div ref={contentRef} className="grid grid-cols-[var(--badge-col)_minmax(0,1fr)_auto] gap-x-3 py-2.5">
                <div {...lead} className={cn("relative isolate col-span-3 col-start-1 row-span-3 row-start-1 grid grid-cols-subgrid grid-rows-subgrid items-start text-left", className)}>
                    {children}
                </div>
                {below && <div className="col-span-2 col-start-2 row-start-4 mt-2.5 flex min-w-0 flex-col gap-2">{below}</div>}
            </div>
        </div>
    );
};

/**
 * A row's headsign, starred when pinned. Long ones wrap; the star and what follows (interchanges) stay on the
 * line of its last word, so they never wrap onto a line of their own.
 */
export const RowHeadsign = ({ headsign, isPinned = false, children }: { headsign: string; isPinned?: boolean; children?: React.ReactNode }) => {
    const [lead, last] = splitLastWord(wrappableName(headsign));
    return (
        <span className="col-start-2 min-w-0 py-[calc((--spacing(6)-1lh)/2)] text-title font-medium leading-tight text-foreground wrap-break-word">
            {lead}
            <span className="inline-flex items-center gap-x-1.5 whitespace-nowrap">
                {last}
                {isPinned && <Star size={14} strokeWidth={1.75} fill="currentColor" className="shrink-0 text-favorite" aria-hidden="true" />}
                {children}
            </span>
        </span>
    );
};

/** A row's second line, under the headsign: the departure time, or why there is none. */
export const RowTimeLine = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <span className={cn("col-start-2 row-start-2 mt-0.5 flex min-w-0 items-center gap-1.25 text-body-sm leading-4.5 text-muted-foreground tabular-nums", className)}>{children}</span>
);
