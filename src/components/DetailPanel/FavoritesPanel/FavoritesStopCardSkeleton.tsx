import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const FavoritesStopCardSkeleton: React.FC = () => {
    return (
        <div className="w-full flex flex-col p-4 rounded-xl bg-white/4 border border-white/5 shadow-sm relative animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex justify-between items-start gap-2 mb-1">
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        {/* Stop name skeleton */}
                        <Skeleton className="h-5 w-32 rounded-md" />
                        {/* Platform code skeleton */}
                        <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                    </div>
                    {/* Distance / Walk time skeleton */}
                    <Skeleton className="h-3.5 w-24 rounded-md" />
                </div>

                {/* Star icon skeleton */}
                <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
            </div>

            {/* Departures Area */}
            <div className="mt-3 border-t border-white/5 pt-2 flex flex-col gap-2">
                {/* Departure row 1 */}
                <div className="flex items-center justify-between gap-3 py-1">
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
                <div className="flex items-center justify-between gap-3 py-1">
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
            </div>
        </div>
    );
};

FavoritesStopCardSkeleton.displayName = 'FavoritesStopCardSkeleton';
