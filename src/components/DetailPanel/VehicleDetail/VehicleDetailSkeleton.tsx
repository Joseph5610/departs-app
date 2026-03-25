import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';

/**
 * VehicleDetailSkeleton
 * Matches the "new" layout of VehicleHero and VehicleDetail components.
 */
export const VehicleDetailSkeleton: React.FC = () => {
    return (
        <Stack gap={4} className="animate-in fade-in duration-500">
            {/* Header Hero Skeleton - Matches VehicleHero.tsx */}
            <Surface variant="tinted" padding="none" className="relative overflow-hidden border-white/15! rounded-2xl bg-slate-950/20 backdrop-blur-2xl">
                <Stack gap={2} className="relative z-10 px-6 py-6">
                    {/* Route Badge Skeleton */}
                    <Skeleton className="h-7 w-12 rounded-lg" />
                    
                    {/* Title/Headsign Skeleton */}
                    <Skeleton className="h-9 w-3/4 max-w-[320px] my-1.5" />

                    {/* Badge Row Skeleton */}
                    <HStack gap={2}>
                        <Skeleton className="h-6 w-20 rounded-md" />
                        <Skeleton className="h-6 w-28 rounded-md" />
                    </HStack>

                    {/* Metadata Footer Skeleton */}
                    <HStack gap={2} className="mt-4 pt-4 border-t border-white/5 justify-between items-end">
                        <Stack gap={1} className="flex-1">
                            <Skeleton className="h-2 w-24" />
                            <HStack gap={2}>
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-12" />
                            </HStack>
                        </Stack>
                        <HStack gap={3} className="shrink-0">
                            <Skeleton className="w-4 h-4 rounded-full" />
                            <Skeleton className="w-4 h-4 rounded-full" />
                            <Skeleton className="w-4 h-4 rounded-full" />
                        </HStack>
                    </HStack>
                </Stack>
            </Surface>

            {/* Stop List Placeholder - Matches StopTimeline.tsx */}
            <Stack gap={4} className="mt-2">
                <HStack justify="between" className="px-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-8 w-32 rounded-xl" />
                </HStack>
                <Box className="relative pl-6 space-y-8 mt-4">
                    <Box className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border/40" />
                    {[1, 2, 3, 4].map((i) => (
                        <HStack key={i} justify="between" className="relative pr-2">
                            <Box className="absolute -left-[19px] w-2.5 h-2.5 rounded-full bg-muted z-10 top-1.5" />
                            <Stack gap={2} className="flex-1">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-2 w-20" />
                            </Stack>
                            <Skeleton className="h-4 w-12" />
                        </HStack>
                    ))}
                </Box>
            </Stack>
        </Stack>
    );
};

VehicleDetailSkeleton.displayName = 'VehicleDetailSkeleton';
