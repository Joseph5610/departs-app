import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveStatusProps {
    fetching: boolean;
    rawVehicles: any;
    bounds: string | null;
}

export const LiveStatus: React.FC<LiveStatusProps> = ({ fetching, rawVehicles, bounds }) => {
    const [nextRefreshIn, setNextRefreshIn] = useState(15);

    useEffect(() => {
        const timer = setInterval(() => {
            setNextRefreshIn((prev) => (prev > 0 ? prev - 1 : 15));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!fetching) {
            setNextRefreshIn(15);
        }
    }, [rawVehicles, fetching]);

    if (!bounds) return null;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="live-pill"
                initial={{ opacity: 0, y: -20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -20, x: '-50%' }}
                className="absolute top-4 left-1/2 z-10 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-2xl pointer-events-none"
                style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
            >
                <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${fetching ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                    {fetching ? (
                        'Refreshing'
                    ) : (
                        <>
                            Live
                            <span className="text-slate-500 font-mono tabular-nums">{nextRefreshIn}s</span>
                        </>
                    )}
                </span>
            </motion.div>
        </AnimatePresence>
    );
};
