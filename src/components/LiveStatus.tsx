import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useMap } from '../hooks/useMap';
import { useVehicles } from '../hooks/useVehicles';
import { cn } from '@/lib/utils';


export const LiveStatus: React.FC = () => {
    const { t } = useTranslation();
    const { state } = useMap();
    const { isFetching: fetching, dataUpdatedAt: lastUpdate } = useVehicles();

    const { bounds } = state;
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
        <AnimatePresence mode="wait">
            <motion.div
                key="live-pill"
                initial={{ opacity: 0, y: -20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -20, x: '-50%' }}
                className="absolute left-1/2 z-10 flex items-center gap-2 px-3 py-1.5 bg-background/40 backdrop-blur-md rounded-full border border-border shadow-2xl pointer-events-none"
                style={{ top: 'calc(4.5rem + env(safe-area-inset-top, 0px))' }}
            >
                <div className={cn(
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
            </motion.div>
        </AnimatePresence>
    );
};
