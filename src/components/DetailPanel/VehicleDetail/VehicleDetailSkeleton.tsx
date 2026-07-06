import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * VehicleDetailSkeleton
 * Matches the "new" layout of VehicleHero and VehicleDetail components.
 */
export const VehicleDetailSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
            {/* Header Hero Skeleton - Matches VehicleHero.tsx */}
            <div className="rounded-2xl bg-muted/40 border border-white/5">
                <div className="flex flex-col gap-2 relative z-10 px-6 py-6">
                    {/* Route Badge Skeleton */}
                    <Skeleton className="h-7 w-12 rounded-lg" />
                    
                    {/* Title/Headsign Skeleton */}
                    <Skeleton className="h-9 w-3/4 max-w-[320px] my-1.5" />

                    {/* Badge Row Skeleton */}
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-20 rounded-md" />
                        <Skeleton className="h-6 w-28 rounded-md" />
                    </div>

                    {/* Metadata Footer Skeleton */}
                    <div className="flex items-end justify-between gap-2 mt-4 pt-4 border-t border-white/5">
                        <div className="flex flex-col gap-1 flex-1">
                            <Skeleton className="h-2 w-24" />
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-12" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <Skeleton className="w-4 h-4 rounded-full" />
                            <Skeleton className="w-4 h-4 rounded-full" />
                            <Skeleton className="w-4 h-4 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stop List Placeholder - Matches StopTimeline.tsx */}
            <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center justify-between px-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-8 w-32 rounded-xl" />
                </div>
                <div className="relative pl-6 space-y-8 mt-4">
                    <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border/40" />
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center justify-between relative pr-2">
                            <div className="absolute -left-[19px] w-2.5 h-2.5 rounded-full bg-muted z-10 top-1.5" />
                            <div className="flex flex-col gap-2 flex-1">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-2 w-20" />
                            </div>
                            <Skeleton className="h-4 w-12" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

VehicleDetailSkeleton.displayName = 'VehicleDetailSkeleton';
