import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useViewport } from '../../state/MapStateProvider';
import { useVehicles } from '../../hooks/data/useVehicles';
import { cn } from '@/lib/utils';
import { Overlay, HStack, Box, Surface } from '@/components/ui/layout';

/**
 * LiveStatus Component
 *
 * Uses semantic components and standardized layout.
 */
export const LiveStatus: React.FC = () => {
    const { t } = useTranslation();
    const { state: vpState } = useViewport();
    const { isFetching: fetching, dataUpdatedAt: lastUpdate } = useVehicles();

    const { bounds } = vpState;
    const [nextRefreshIn, setNextRefreshIn] = useState(10);

    useEffect(() => {
        const calculateRemaining = () => {
            const now = Date.now();
            const elapsed = Math.floor((now - lastUpdate) / 1000);
            const remaining = Math.max(0, 10 - elapsed);
            setNextRefreshIn(remaining);
        };

        calculateRemaining();
        const timer = setInterval(calculateRemaining, 1000);
        return () => clearInterval(timer);
    }, [lastUpdate]);

    if (!bounds) return null;

    return (
        <Overlay position="top-center" className="pt-[calc(4.75rem+env(safe-area-inset-top,0px))] md:pt-[calc(5.25rem+env(safe-area-inset-top,0px))]">
            <AnimatePresence mode="wait">
                <motion.div
                    key="live-pill"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                >
                    <Surface
                        variant="tinted"
                        padding="none"
                        className="px-3 py-1.5 rounded-full border-white/10! shadow-2xl"
                    >
                        <HStack gap={2}>
                            <Box className={cn(
                                "w-2 h-2 rounded-full transition-colors duration-500",
                                fetching ? "bg-amber-500 animate-pulse" : "bg-primary"
                            )} />
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                                {fetching ? (
                                    <span className="text-amber-500">{t('liveStatus.refreshing')}</span>
                                ) : (
                                    <>
                                        <span className="text-primary">{t('liveStatus.live')}</span>
                                        <span className="text-muted-foreground/60 tabular-nums">{nextRefreshIn}s</span>
                                    </>
                                )}
                            </span>
                        </HStack>
                    </Surface>
                </motion.div>
            </AnimatePresence>
        </Overlay>
    );
};

LiveStatus.displayName = 'LiveStatus';
