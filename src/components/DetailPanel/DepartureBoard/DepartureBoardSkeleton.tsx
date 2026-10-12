import type React from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { badgeColumnStyle } from '@/lib/lineBadge';
import { RowSeparator } from './RowSeparator';
import { BoardSection } from './BoardRow';

/** The badge column of a loading list: as wide as a two-character line, the most common width. */
const SKELETON_BADGE_COLUMN = badgeColumnStyle(['00']);

/** A loading list's frame: the board's inset card, or a plain stack, with the board's badge column set. */
export const SkeletonList = ({ card = true, className, children }: { card?: boolean; className?: string; children: React.ReactNode }) => card ? (
    <Card size="none" variant="inset" className={cn("px-2 animate-in fade-in duration-500", className)} style={SKELETON_BADGE_COLUMN} aria-hidden="true">{children}</Card>
) : (
    <div className={cn("flex flex-col animate-in fade-in duration-500", className)} style={SKELETON_BADGE_COLUMN} aria-hidden="true">{children}</div>
);

interface NextDepartureRowSkeletonProps {
    headsignWidth: string;
    children?: React.ReactNode;
}

/** Mirrors NextDepartureRow on the same grid: badge, headsign and countdown, then the time line and amenities, then what follows. */
export const NextDepartureRowSkeleton = ({ headsignWidth, children }: NextDepartureRowSkeletonProps) => (
    <div className={cn("grid grid-cols-[var(--badge-col)_minmax(0,1fr)_auto] items-start gap-x-2.5 py-2 pl-1.5 pr-2", !children && "pb-1")}>
        <Skeleton className="h-6 w-(--badge-col) rounded-md" />
        <Skeleton className={cn("my-1 h-4", headsignWidth)} />
        <Skeleton className="h-6 w-14" />
        <Skeleton className="col-start-2 row-start-2 mt-2 h-3 w-24" />
        <Skeleton className="col-start-3 row-start-2 mt-2 h-3 w-8 justify-self-end" />
        {children && <div className="col-span-2 col-start-2 mt-3 flex flex-col gap-2">{children}</div>}
    </div>
);

interface DirectionRowSkeletonProps {
    headsignWidth: string;
    chips: number;
    /** A divider above, as where a new line starts on the board. */
    divider: boolean;
    /** A further direction of the line above, which follows it closely. */
    continuesLine?: boolean;
    /** A note line above the chips, as a pinned line's "From <stop>". */
    note?: boolean;
}

/** Mirrors a DirectionRow: the next departure, then the chips. */
export const DirectionRowSkeleton = ({ headsignWidth, chips, divider, continuesLine = false, note = false }: DirectionRowSkeletonProps) => (
    <>
        {divider && <RowSeparator />}
        <BoardSection continuesLine={continuesLine}>
            <NextDepartureRowSkeleton headsignWidth={headsignWidth}>
                {(chips > 0 || note) && (
                    <>
                        {note && <Skeleton className="my-0.5 h-3 w-40" />}
                        {chips > 0 && (
                            <div className="flex gap-1.5">
                                {Array.from({ length: chips }, (_, idx) => <Skeleton key={idx} className="h-7 w-16 rounded-full" />)}
                            </div>
                        )}
                    </>
                )}
            </NextDepartureRowSkeleton>
        </BoardSection>
    </>
);

/** DepartureBoardSkeleton: a few direction rows, one line with two directions among them. */
export const DepartureBoardSkeleton = () => (
    <SkeletonList>
        <DirectionRowSkeleton headsignWidth="w-36" chips={2} divider={false} />
        <DirectionRowSkeleton headsignWidth="w-28" chips={2} divider={false} continuesLine />
        <DirectionRowSkeleton headsignWidth="w-40" chips={2} divider />
        <DirectionRowSkeleton headsignWidth="w-24" chips={1} divider />
    </SkeletonList>
);
