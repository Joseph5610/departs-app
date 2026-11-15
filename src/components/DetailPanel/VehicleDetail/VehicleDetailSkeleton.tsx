import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { HeroFooter } from '@/components/DetailPanel/HeroFooter';

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
    <Card size="none" className="overflow-hidden relative flex flex-col bg-(--hero-base)">
        <div className="flex flex-col p-3.5 pb-2.5">
            <div className="flex justify-between items-start gap-3">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex h-4 items-center"><Skeleton className="h-2.5 w-12" /></div>
                    <div className="flex h-7 items-center"><Skeleton className="h-5.5 w-3/4 max-w-80 rounded-badge" /></div>
                </div>
                <Skeleton className="size-8 rounded-full shrink-0" />
            </div>
            <div className="flex gap-2 items-center mt-3">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>
        </div>

        <HeroFooter className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex h-4.5 items-center"><Skeleton className="h-3 w-40" /></div>
                <div className="flex h-4 items-center"><Skeleton className="h-2.5 w-16" /></div>
                <div className="flex h-4 items-center"><Skeleton className="h-2.5 w-28" /></div>
            </div>
            <Skeleton className="size-8 shrink-0 rounded-nested" />
        </HeroFooter>
    </Card>
);

export const StopTimelineSkeleton = () => (
    <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full rounded-full" />
        <div className="flex h-4 items-center px-1"><Skeleton className="h-2.5 w-24" /></div>
        <div className="relative pl-6">
            <div className="absolute left-2.75 top-5 bottom-5 w-0.5 bg-border/40" />
            {['w-32', 'w-40', 'w-32', 'w-44', 'w-28', 'w-36'].map((width, i) => (
                <div key={i} className="flex justify-between items-center relative min-h-10">
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
