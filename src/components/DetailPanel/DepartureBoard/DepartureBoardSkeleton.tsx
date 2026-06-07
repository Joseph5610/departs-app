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
                    className="flex flex-col rounded-xl overflow-hidden border border-white/5 bg-white/1"
                >
                    {/* Primary Group Header Skeleton */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/4 border-b border-white/5">
                        <Skeleton className="h-5 w-8 rounded-md" />
                        <div className="w-3 h-3 bg-white/5 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    
                    {/* First Sub-group rows */}
                    <div className="flex flex-col border-b border-white/5">
                        {[1, 2].map((item) => (
                            <div key={item} className="flex items-center gap-2 py-2 px-3">
                                <div className="shrink-0 w-[82px]"><Skeleton className="h-4 w-12" /></div>
                                <div className="shrink-0 w-[32px] flex gap-1">
                                    <Skeleton className="h-3 w-3 rounded-full" />
                                    <Skeleton className="h-3 w-3 rounded-full" />
                                </div>
                                <div className="flex-1"><Skeleton className="h-3 w-1/2 opacity-20" /></div>
                                <div className="shrink-0 w-[48px] flex justify-end"><Skeleton className="h-5 w-10" /></div>
                            </div>
                        ))}
                    </div>

                    {/* Secondary Variant Header Skeleton */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border-t border-white/10 shadow-[0_-2px_4px_rgba(0,0,0,0.2)]">
                        <div className="w-[2px] h-3 bg-white/10 rounded-full shrink-0" />
                        <div className="w-2.5 h-2.5 bg-white/5 rounded-full ml-1" />
                        <Skeleton className="h-3 w-24 opacity-50" />
                    </div>

                    {/* Second Sub-group rows */}
                    <div className="flex flex-col">
                        {[1].map((item) => (
                            <div key={item} className="flex items-center gap-2 py-2 px-3">
                                <div className="shrink-0 w-[82px]"><Skeleton className="h-4 w-12" /></div>
                                <div className="shrink-0 w-[32px] flex gap-1">
                                    <Skeleton className="h-3 w-3 rounded-full" />
                                </div>
                                <div className="flex-1"><Skeleton className="h-3 w-1/3 opacity-20" /></div>
                                <div className="shrink-0 w-[48px] flex justify-end"><Skeleton className="h-5 w-10" /></div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

DepartureBoardSkeleton.displayName = 'DepartureBoardSkeleton';
