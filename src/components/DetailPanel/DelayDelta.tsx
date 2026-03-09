import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { HStack } from '@/components/ui/layout';

/**
 * Displays the real-time delay trend (up/down arrow and value in seconds).
 * Animates in when a new update is received and fades out after 5 seconds.
 */
export const DelayDelta = ({ delta, lastUpdate, isInline = false }: { delta: number; lastUpdate?: number; isInline?: boolean }) => {
    const [visible, setVisible] = useState(false);
    const [prevLastUpdate, setPrevLastUpdate] = useState<number | undefined>(undefined);

    // Sync state from props during render - this is the recommended React pattern
    // for resetting state when a prop changes.
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
                    className={isInline ? "ml-1" : ""}
                >
                    <HStack className={cn(
                        "px-1 rounded text-[9px] font-bold tabular-nums gap-0.5",
                        delta > 0 ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                    )}>
                        <span>{delta > 0 ? '↑' : '↓'}</span>
                        <span>{Math.abs(delta)}s</span>
                    </HStack>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
