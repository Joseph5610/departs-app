import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

/** Mirrors FavoritesStopCard: stop header with distance and unpin action, then the next departures. */
export const FavoritesStopCardSkeleton: React.FC = () => {
    return (
        <Card
            variant="subtle"
            size="none"
            className="w-full relative animate-in fade-in duration-500 bg-card border-border/50 shadow-sm"
        >
            <CardHeader className="flex items-center justify-between gap-2 border-b border-border/50 p-3 px-4">
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                        <Skeleton className="h-4.5 w-32" />
                    </div>
                    <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="size-6 rounded-md shrink-0" />
            </CardHeader>

            <CardContent className="p-3 px-4 flex flex-col gap-2">
                {['w-24', 'w-16'].map((headsignWidth) => (
                    <div key={headsignWidth} className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Skeleton className="h-4.5 w-7 rounded-sm shrink-0" />
                            <Skeleton className="h-3 w-3 rounded-sm shrink-0" />
                            <Skeleton className={`h-3.5 ${headsignWidth}`} />
                        </div>
                        <Skeleton className="h-3.5 w-10 shrink-0" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

FavoritesStopCardSkeleton.displayName = 'FavoritesStopCardSkeleton';
