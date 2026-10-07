import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { cn } from 'cn';

/**
 * VehicleDetailSkeleton
 * Mirrors the layout of VehicleHero and StopTimeline.
 */
export const VehicleDetailSkeleton = () => {
    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
            <VehicleHeroSkeleton />
            <StopTimelineSkeleton />
        </div>
    );
};

const VehicleHeroSkeleton = () => (
    <Card
        size="none"
        className="border border-border/50 ring-0 overflow-hidden relative flex flex-col shadow-sm bg-(--hero-base)"
    >
        <div className="flex flex-col p-4 pb-3">
            <div className="flex justify-between items-start gap-3">
                <div className="flex flex-col gap-1.5 min-w-0 flex-1 pt-0.5">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-7 w-3/4 max-w-80 rounded-md" />
                </div>
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            </div>
        </div>

        <div className="flex gap-2 items-center px-4 pb-4">
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
        </div>

        <div className="flex gap-3 p-3 px-4 bg-muted/20 border-t border-border/50 justify-between items-center">
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <Skeleton className="h-2.5 w-24" />
                <div className="flex items-center gap-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3.5 w-10" />
                </div>
            </div>
            <div className="flex gap-2 shrink-0 bg-muted/50 p-2 rounded-lg items-center">
                <Skeleton className="w-3.5 h-3.5 rounded-full" />
                <Skeleton className="w-3.5 h-3.5 rounded-full" />
                <Skeleton className="w-3.5 h-3.5 rounded-full" />
            </div>
        </div>
    </Card>
);

export const StopTimelineSkeleton = () => (
    <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-7 w-28 rounded-xl" />
        </div>
        <div className="relative pl-6">
            <div className="absolute left-2.75 top-6 bottom-6 w-0.5 bg-border/40" />
            {['w-40', 'w-32', 'w-44', 'w-28', 'w-36'].map((width, i) => (
                <div key={i} className="flex justify-between items-center relative py-2 min-h-11">
                    <div className="absolute -left-4.25 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-muted" />
                    <Skeleton className={cn("h-4", width)} />
                    <div className="flex justify-end shrink-0 min-w-17">
                        <Skeleton className="h-3 w-12" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);
