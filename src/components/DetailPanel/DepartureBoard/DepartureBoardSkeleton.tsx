import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * DepartureBoardSkeleton
 * Mirrors the line-group cards and DepartureItem rows in DepartureBoard.
 */
export const DepartureBoardSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500">
            <Card
                size="none"
                className="border border-border/50 dark:border-white/10 ring-0 bg-card dark:bg-[#161616] shadow-sm mb-3 overflow-hidden"
            >
                <GroupHeaderSkeleton headsignWidth="w-36" />
                <DepartureRowsSkeleton count={3} />
                <div className="flex items-center justify-center py-2.5 border-t border-black/5 dark:border-white/5 bg-black/3 dark:bg-white/3">
                    <Skeleton className="h-2.5 w-28" />
                </div>

                <div className="flex items-center gap-3 py-2.5 border-t border-border/50 dark:border-white/5 bg-foreground/5">
                    <div className="w-1 h-4 rounded-r-sm shrink-0 bg-foreground/15" />
                    <Skeleton className="h-3 w-3 rounded-full shrink-0" />
                    <Skeleton className="h-3.5 w-28" />
                </div>
                <DepartureRowsSkeleton count={1} />
            </Card>

            <Card
                size="none"
                className="border border-border/50 dark:border-white/10 ring-0 bg-card dark:bg-[#161616] shadow-sm mb-3 overflow-hidden"
            >
                <GroupHeaderSkeleton headsignWidth="w-28" />
                <DepartureRowsSkeleton count={2} />
            </Card>
        </div>
    );
};

DepartureBoardSkeleton.displayName = 'DepartureBoardSkeleton';

const GroupHeaderSkeleton: React.FC<{ headsignWidth: string }> = ({ headsignWidth }) => (
    <div className="flex items-center gap-2 p-3 px-4 bg-foreground/5 border-b-2 border-border/50">
        <Skeleton className="h-6 w-10 rounded-md shrink-0" />
        <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
        <Skeleton className={cn("h-4.5", headsignWidth)} />
    </div>
);

const DepartureRowsSkeleton: React.FC<{ count: number }> = ({ count }) => (
    <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
        {Array.from({ length: count }, (_, idx) => (
            <div
                key={idx}
                className={cn(
                    "flex items-center gap-3 py-3 px-4",
                    idx % 2 === 1 && "bg-black/1.5 dark:bg-white/2"
                )}
            >
                <div className="shrink-0 w-21.25">
                    <Skeleton className="h-4 w-10" />
                </div>
                <div className="flex gap-1.5 items-center shrink-0 w-10 ml-1">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <div className="flex-1 min-w-0" />
                <div className="flex justify-end shrink-0 min-w-12">
                    <Skeleton className="h-4 w-10" />
                </div>
            </div>
        ))}
    </div>
);
