import type React from 'react';
import { cn } from '@/lib/cn';
import { Star } from 'lucide-react';
import { splitLastWord, wrappableName } from '@/lib/strings';
import { useSwipeAction } from '@/hooks/features/useSwipeAction';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';

/**
 * A board list's entry, spaced from its neighbours; a line's further direction follows the one above closely.
 * The padding leaves the row's hover backdrop as far from the card edge and separators as the card's side padding.
 */
export const BoardSection = ({ continuesLine = false, children }: { continuesLine?: boolean; children: React.ReactNode }) => (
    <section className={cn("pt-1.5 pb-2.5", continuesLine && "-mt-4")}>{children}</section>
);

/** What swiping a row left, or picking it from the row's right-click menu, does. */
export interface RowAction {
    onTrigger: () => void;
    /** The action's name in the right-click menu. */
    label: string;
    /** The action undoes itself, e.g. the line is already pinned; its revealed star shows filled. */
    isActive: boolean;
}

interface BoardRowProps extends React.HTMLAttributes<HTMLDivElement> {
    action?: RowAction;
    /** Content under the row in the headsign column, e.g. the later departures. */
    below?: React.ReactNode;
}

/**
 * The board's row grid: badge, headsign and time columns. `children` are the lead row's cells (badge,
 * headsign, countdown, then time line, amenities and notes); the element holding them, which gets the other
 * props, shares the grid's tracks, so `below` aligns to its cells. With an `action`, the row slides left
 * under a swipe to reveal a star and runs it past the threshold; a right click offers it in a menu.
 */
export const BoardRow = ({ action, ...props }: BoardRowProps) => {
    if (!action) return <RowBody {...props} />;
    return (
        <ContextMenu>
            <ContextMenuTrigger
                // Touch has the swipe; a long press stays a tap's start rather than opening the menu.
                onTouchStart={(e) => e.preventBaseUIHandler()}
                render={(trigger) => <RowBody action={action} outer={trigger} {...props} />}
            />
            <ContextMenuContent>
                <ContextMenuItem onClick={action.onTrigger}>
                    <Star strokeWidth={1.75} className="text-favorite" fill={action.isActive ? 'currentColor' : 'none'} />
                    {action.label}
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

/** The row itself; `outer` are the context menu trigger's props, which go on the element under the pointer. */
const RowBody = ({ action, below, className, children, outer, ...lead }: BoardRowProps & { outer?: React.ComponentProps<'div'> }) => {
    const { contentRef, handlers } = useSwipeAction(action?.onTrigger);
    return (
        <div {...outer} {...handlers} className="group/row relative touch-pan-y">
            {action && (
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-favorite opacity-(--swipe,0)">
                    <Star size={22} strokeWidth={1.75} className="transition-transform group-data-armed/row:scale-125" fill={action.isActive ? 'currentColor' : 'none'} />
                </span>
            )}
            {/* Ending on text, whose line box leaves room under the glyphs, the row's bottom padding is that much shorter. */}
            <div ref={contentRef} className={cn("grid grid-cols-[var(--badge-col)_minmax(0,1fr)_auto] gap-x-2.5 py-2 pl-1.5 pr-2", !below && "pb-1")}>
                <div {...lead} className={cn("relative isolate col-span-3 col-start-1 row-span-3 row-start-1 grid grid-cols-subgrid grid-rows-subgrid items-start text-left", className)}>
                    {children}
                </div>
                {below && <div className="col-span-2 col-start-2 row-start-4 mt-3 flex min-w-0 flex-col gap-2">{below}</div>}
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
        <span className="col-start-2 min-w-0 py-[calc((--spacing(6)-1lh)/2)] text-title font-semibold leading-tight text-foreground wrap-break-word">
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
    <span className={cn("col-start-2 row-start-2 mt-1 flex min-w-0 items-center gap-1 text-body-sm leading-5 text-muted-foreground", className)}>{children}</span>
);
