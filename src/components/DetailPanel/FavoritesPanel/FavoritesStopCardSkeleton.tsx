import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export const FavoritesStopCardSkeleton: React.FC = () => {
    return (
        <Card variant="subtle" className="w-full relative animate-in fade-in duration-500 bg-foreground/10 border-border/50 shadow-sm">
            {/* Header Area */}
            <CardHeader className="flex items-start justify-between gap-2 space-y-0 border-b border-border/50 pb-3">
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <CardTitle className="flex items-center gap-1.5">
                        {/* Platform code skeleton */}
                        <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                        {/* Stop name skeleton */}
                        <Skeleton className="h-5 w-32 rounded-md" />
                    </CardTitle>
                    {/* Distance / Walk time skeleton */}
                    <Skeleton className="h-3.5 w-24 rounded-md" />
                </div>

                {/* Star icon skeleton */}
                <Skeleton className="w-6 h-6 rounded-lg shrink-0 -mr-2 -mt-1" />
            </CardHeader>

            {/* Departures Area */}
            <CardContent className="pt-3 flex flex-col gap-2">
                {/* Departure row 1 */}
                <div className="flex items-center justify-between gap-3 py-0.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Line badge skeleton */}
                        <Skeleton className="h-5 w-8 rounded-md shrink-0" />
                        {/* Arrow icon skeleton */}
                        <Skeleton className="h-2.5 w-3.5 rounded-sm shrink-0" />
                        {/* Headsign skeleton */}
                        <Skeleton className="h-4 w-24 rounded-md" />
                    </div>
                    {/* Time countdown skeleton */}
                    <Skeleton className="h-4 w-10 rounded-md shrink-0" />
                </div>

                {/* Departure row 2 */}
                <div className="flex items-center justify-between gap-3 py-0.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Line badge skeleton */}
                        <Skeleton className="h-5 w-8 rounded-md shrink-0" />
                        {/* Arrow icon skeleton */}
                        <Skeleton className="h-2.5 w-3.5 rounded-sm shrink-0" />
                        {/* Headsign skeleton */}
                        <Skeleton className="h-4 w-16 rounded-md" />
                    </div>
                    {/* Time countdown skeleton */}
                    <Skeleton className="h-4 w-10 rounded-md shrink-0" />
                </div>
            </CardContent>
        </Card>
    );
};

FavoritesStopCardSkeleton.displayName = 'FavoritesStopCardSkeleton';
