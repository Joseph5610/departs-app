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
    <SkeletonList card={false} className="gap-3">
        {Array.from({ length: count }, (_, idx) => (
            <Card key={idx} size="none" variant="inset" className="px-2">
                {/* Mirrors FavoriteStopSection: the stop header, a divider, then two departure rows. */}
                <div className="flex flex-col gap-1 py-2.5">
                    <div className="flex items-center gap-3 py-2 pl-2 pr-3">
                        <Skeleton className="size-9 shrink-0 rounded-full" />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <Skeleton className={cn("h-4.5", idx % 2 ? "w-32" : "w-44")} />
                            <Skeleton className="h-3 w-14" />
                        </div>
                        <Skeleton className="size-4 rounded-full" />
                    </div>
                    <RowSeparator inset={false} className="my-1" />
                    <NextDepartureRowSkeleton headsignWidth="w-32" />
                    <NextDepartureRowSkeleton headsignWidth="w-24" />
                </div>
            </Card>
        ))}
    </SkeletonList>
);
