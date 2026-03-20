import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';

/**
 * VehicleDetailSkeleton
 * Matches the layout of the hero section and metadata grid in VehicleDetail.tsx
 */
export const VehicleDetailSkeleton: React.FC = () => {
    return (
        <Stack gap={4} className="animate-in fade-in duration-500">
            {/* Header Hero Skeleton */}
            <Surface variant="tinted" padding="md" className="relative overflow-hidden border-white/10!">
                <Stack gap={3}>
                    {/* Status Row Skeleton */}
                    <HStack align="center" gap={2}>
                        <Skeleton className="h-9 w-24 rounded-xl" />
                        <Skeleton className="h-9 w-20 rounded-full" />
                        <Skeleton className="h-9 w-28 rounded-full" />
                    </HStack>
                    
                    {/* Title/Headsign Skeleton */}
                    <Skeleton className="h-8 w-3/4 max-w-[300px]" />
                </Stack>
            </Surface>

            {/* Metadata Grid Skeleton */}
            <HStack align="stretch" gap={2}>
                <Surface variant="tinted" padding="sm" className="flex-1 min-w-0 justify-between flex flex-row items-center px-3 h-[52px] border-white/10!">
                    <HStack gap={2} className="min-w-0">
                        <Skeleton className="w-3.5 h-3.5 rounded-full shrink-0" />
                        <Stack gap={2} className="min-w-0">
                            <Skeleton className="h-2 w-16" />
                            <HStack gap={2}>
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-2 w-12" />
                            </HStack>
                        </Stack>
                    </HStack>
                    <HStack gap={2}>
                        <Skeleton className="w-4 h-4 rounded-full" />
                        <Skeleton className="w-4 h-4 rounded-full" />
                    </HStack>
                </Surface>
                <Surface variant="tinted" padding="sm" className="flex-initial min-w-[70px] flex flex-row items-center px-3 h-[52px] border-white/10!">
                    <Skeleton className="w-3.5 h-3.5 rounded-full shrink-0 mr-2" />
                    <Stack gap={2}>
                        <Skeleton className="h-2 w-8" />
                        <Skeleton className="h-3 w-10" />
                    </Stack>
                </Surface>
            </HStack>

            {/* Stop List Placeholder */}
            <Stack gap={3} className="mt-2">
                <HStack justify="between" className="px-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-28 rounded-xl" />
                </HStack>
                <Box className="relative pl-6 space-y-6 mt-4">
                    <Box className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border/40" />
                    {[1, 2, 3].map((i) => (
                        <HStack key={i} justify="between" className="relative pr-2">
                            <Box className="absolute -left-[19px] w-2.5 h-2.5 rounded-full bg-muted z-10 top-1.5" />
                            <Stack gap={2} className="flex-1">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-2 w-16" />
                            </Stack>
                            <Skeleton className="h-4 w-12" />
                        </HStack>
                    ))}
                </Box>
            </Stack>
        </Stack>
    );
};

/**
 * DepartureListSkeleton
 * Matches the layout of the grouped departure items in DetailPanelContent.tsx
 */
export const DepartureListSkeleton: React.FC = () => {
    return (
        <Stack gap={6} className="animate-in fade-in duration-500">
            {[1, 2, 3].map((group) => (
                <Stack key={group} gap={3}>
                    {/* Group Header Skeleton */}
                    <HStack gap={3} className="px-1">
                        <Skeleton className="h-6 w-10 rounded-lg" />
                        <Box className="h-[1px] flex-1 bg-border/40" />
                    </HStack>
                    
                    {/* Departure Items Skeletons */}
                    <Stack gap={2}>
                        {[1, 2].map((item) => (
                            <Surface key={item} variant="tinted" padding="sm" className="flex flex-row items-center justify-between h-[60px] border-white/10!">
                                <HStack gap={3}>
                                    <Skeleton className="w-8 h-8 rounded-full" />
                                    <Stack gap={2}>
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-2 w-16" />
                                    </Stack>
                                </HStack>
                                <Stack align="end" gap={2}>
                                    <Skeleton className="h-4 w-10" />
                                    <Skeleton className="h-2 w-14" />
                                </Stack>
                            </Surface>
                        ))}
                    </Stack>
                </Stack>
            ))}
        </Stack>
    );
};
