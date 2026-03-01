import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Displays the real-time delay trend (up/down arrow and value in seconds).
 * Animates in when a new update is received and fades out after 5 seconds.
 */
export const DelayDelta = ({ delta, lastUpdate, isInline = false }: { delta: number; lastUpdate?: number; isInline?: boolean }) => {
    const [isTimedOut, setIsTimedOut] = useState(false);
    const [lastHandledUpdate, setLastHandledUpdate] = useState<number | undefined>(undefined);

    // Reset timeout state when the update timestamp changes.
    if (lastUpdate !== lastHandledUpdate) {
        setLastHandledUpdate(lastUpdate);
        setIsTimedOut(false);
    }

    const isFresh = delta !== 0 && !!lastUpdate && (Date.now() - lastUpdate < 5000);
    const visible = isFresh && !isTimedOut;

    useEffect(() => {
        if (visible && lastUpdate) {
            const age = Date.now() - lastUpdate;
            const timer = setTimeout(() => setIsTimedOut(true), 5000 - age);
            return () => clearTimeout(timer);
        }
    }, [visible, lastUpdate]);

    return (
        <AnimatePresence>
            {visible && delta !== 0 && (
                <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 5 }}
                    className={`px-1 rounded text-[9px] font-bold tabular-nums flex items-center gap-0.5 ${isInline ? 'ml-1' : ''} ${delta > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                >
                    <span>{delta > 0 ? '↑' : '↓'}</span>
                    <span>{Math.abs(delta)}s</span>
                </motion.span>
            )}
        </AnimatePresence>
    );
};
