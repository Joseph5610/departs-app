import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveStatusProps {
    fetching: boolean;
    bounds: string | null;
    lastUpdate: number;
}

export const LiveStatus: React.FC<LiveStatusProps> = ({ fetching, bounds, lastUpdate }) => {
    const { t } = useTranslation();
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
                className="absolute top-18 md:top-4 left-1/2 z-10 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-2xl pointer-events-none"
                style={{ top: 'calc(4.5rem + env(safe-area-inset-top, 0px))' }}
            >
                <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${fetching ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                    {fetching ? (
                        t('liveStatus.refreshing')
                    ) : (
                        <>
                            {t('liveStatus.live')}
                            <span className="text-zinc-500 font-mono tabular-nums">{nextRefreshIn}s</span>
                        </>
                    )}
                </span>
            </motion.div>
        </AnimatePresence>
    );
};
