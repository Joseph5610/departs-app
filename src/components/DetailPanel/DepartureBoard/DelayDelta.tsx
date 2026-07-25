import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Displays the real-time delay trend (up/down arrow and value in seconds).
 * Animates in when a new update is received and fades out after 5 seconds.
 */
export const DelayDelta = ({ delta, lastUpdate, isInline = false }: { delta: number; lastUpdate?: number; isInline?: boolean }) => {
    const [visible, setVisible] = useState(false);
    const [prevLastUpdate, setPrevLastUpdate] = useState<number | undefined>(undefined);

    if (lastUpdate !== prevLastUpdate) {
        setPrevLastUpdate(lastUpdate);
        if (delta !== 0 && lastUpdate) {
            setVisible(true);
        }
    }

    useEffect(() => {
        if (visible && lastUpdate) {
            const age = Date.now() - lastUpdate;
            const remaining = Math.max(0, 5000 - age);

            const timer = setTimeout(() => {
                setVisible(false);
            }, remaining);
            return () => clearTimeout(timer);
        }
    }, [visible, lastUpdate]);

    return (
        <AnimatePresence>
            {visible && delta !== 0 && (
                <motion.div
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 5 }}
                    transition={{ duration: 0.25 }}
                    className={isInline ? "ml-1" : ""}
                >
                    <div className={cn(
                        "flex items-center gap-1 font-bold tabular-nums text-[8px] opacity-60",
                        delta > 0 ? "text-rose-400" : "text-emerald-400"
                    )}>
                        <span>{delta > 0 ? '▲' : '▼'}</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
