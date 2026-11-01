import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DirectionRowSkeleton, NextDepartureRowSkeleton, SkeletonList } from '@/components/DetailPanel/DepartureBoard/DepartureBoardSkeleton';
import { RowSeparator } from '@/components/DetailPanel/DepartureBoard/RowSeparator';

interface FavoritesSkeletonProps {
    /** Pinned lines load as rows of one list, pinned stops as one card each: a stop header over two departure rows. */
    kind: 'lines' | 'stops';
    count: number;
}

/** The favourites list while it loads, shaped like the rows it will hold. */
export const FavoritesSkeleton = ({ kind, count }: FavoritesSkeletonProps) => kind === 'lines' ? (
    <SkeletonList>
        {Array.from({ length: count }, (_, idx) => (
            <DirectionRowSkeleton key={idx} headsignWidth={idx % 2 ? 'w-28' : 'w-36'} chips={2} divider={idx > 0} note />
        ))}
    </SkeletonList>
) : (
    <SkeletonList card={false} className="gap-5">
        {Array.from({ length: count }, (_, idx) => (
            <div key={idx} className="flex flex-col gap-2">
                {/* Mirrors FavoriteStopSection: the stop header above a card of departure rows. */}
                <div className="flex min-h-7 items-center gap-2">
                    <Skeleton className="size-5.5 shrink-0 rounded-full" />
                    <Skeleton className={cn("h-4.5", idx % 2 ? "w-32" : "w-44")} />
                </div>
                <Card size="none" className="px-3.5">
                    <NextDepartureRowSkeleton headsignWidth="w-32" />
                    <RowSeparator />
                    <NextDepartureRowSkeleton headsignWidth="w-24" />
                </Card>
            </div>
        ))}
    </SkeletonList>
);
