import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';

/**
 * DepartureBoardSkeleton
 * Matches the layout of the grouped departure items in DepartureBoard.tsx
 */
export const DepartureBoardSkeleton: React.FC = () => {
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
                            <Surface key={item} variant="tinted" padding="md" className="flex flex-row items-center justify-between h-[68px] border-white/10! rounded-2xl">
                                <HStack gap={3}>
                                    <Stack gap={2}>
                                        <Skeleton className="h-4 w-40 sm:w-48" />
                                        <Skeleton className="h-3 w-20" />
                                    </Stack>
                                </HStack>
                                <Stack align="end" gap={2}>
                                    <Skeleton className="h-5 w-12" />
                                    <Skeleton className="h-3 w-16" />
                                </Stack>
                            </Surface>
                        ))}
                    </Stack>
                </Stack>
            ))}
        </Stack>
    );
};

DepartureBoardSkeleton.displayName = 'DepartureBoardSkeleton';
