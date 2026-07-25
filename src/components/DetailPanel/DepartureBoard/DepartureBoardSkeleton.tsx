import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * DepartureBoardSkeleton
 * Matches the layout of the grouped departure items in DepartureBoard.tsx
 */
export const DepartureBoardSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500">
            {[1].map((group) => (
                <div 
                    key={group} 
                    className="flex flex-col rounded-xl overflow-hidden border border-border/50 bg-foreground/1 shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                >
                    {/* Primary Group Header Skeleton */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-foreground/4 border-b border-border/50">
                        <Skeleton className="h-5 w-8 rounded-md" />
                        <div className="w-3 h-3 bg-foreground/5 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    
                    {/* First Sub-group rows */}
                    <div className="flex flex-col border-b border-border/50">
                        {[1, 2].map((item) => (
                            <div key={item} className="flex items-center gap-2 py-2 px-3">
                                <div className="shrink-0 w-20.5"><Skeleton className="h-4 w-12" /></div>
                                <div className="shrink-0 w-8 flex gap-1">
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                </div>
                                <div className="flex-1">
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                                <div className="shrink-0 w-12 flex justify-end"><Skeleton className="h-5 w-10" /></div>
                            </div>
                        ))}
                    </div>

                    {/* Secondary Variant Header Skeleton */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-foreground/5 border-t border-border/50 shadow-[0_-2px_4px_rgba(0,0,0,0.2)]">
                        <div className="w-0.5 h-3 bg-foreground/10 rounded-full shrink-0" />
                        <div className="w-2.5 h-2.5 bg-foreground/5 rounded-full ml-1" />
                        <Skeleton className="h-3 w-24 opacity-50" />
                    </div>

                    {/* Second Sub-group rows */}
                    <div className="flex flex-col">
                        {[1].map((item) => (
                            <div key={item} className="flex items-center gap-2 py-2 px-3">
                                <div className="shrink-0 w-20.5"><Skeleton className="h-4 w-12" /></div>
                                <div className="shrink-0 w-8 flex gap-1">
                                    <Skeleton className="h-3 w-3 rounded-full" />
                                </div>
                                <div className="flex-1"><Skeleton className="h-3 w-1/3 opacity-20" /></div>
                                <div className="shrink-0 w-12 flex justify-end"><Skeleton className="h-5 w-10" /></div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

DepartureBoardSkeleton.displayName = 'DepartureBoardSkeleton';
