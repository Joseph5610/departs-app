import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

/** Mirrors FavoritesStopCard: stop header with distance and unpin action, then the next departures. */
export const FavoritesStopCardSkeleton: React.FC = () => {
    return (
        <Card
            variant="subtle"
            size="none"
            className="w-full relative overflow-hidden animate-in fade-in duration-500 border border-border/50 dark:border-white/10 ring-0 bg-card dark:bg-[#161616] shadow-sm"
        >
            <div className="flex items-center justify-between gap-2 border-b border-border/50 dark:border-white/10 bg-muted/40 dark:bg-white/[0.04] py-1.5 pl-4 pr-2">
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                        <Skeleton className="h-4.5 w-32" />
                    </div>
                    <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="size-9 rounded-full shrink-0" />
            </div>

            <CardContent className="p-0 flex flex-col divide-y divide-black/5 dark:divide-white/5">
                {['w-24', 'w-16'].map((headsignWidth) => (
                    <div key={headsignWidth} className="flex items-center gap-3 min-h-11 py-1.5 px-4">
                        <Skeleton className="h-4 w-10 mr-1 shrink-0" />
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Skeleton className="h-4.5 w-7 rounded-sm shrink-0" />
                            <Skeleton className={`h-4 ${headsignWidth}`} />
                        </div>
                        <Skeleton className="h-4 w-12 shrink-0" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

FavoritesStopCardSkeleton.displayName = 'FavoritesStopCardSkeleton';
