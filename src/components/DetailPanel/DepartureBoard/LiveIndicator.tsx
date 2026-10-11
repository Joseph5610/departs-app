import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { LiveStatus } from '@/domain/departures';
import { LiveSignal } from './LiveSignal';

const TRIANGLE = { up: 'M5 0.5 L9.8 9 H0.2 Z', down: 'M5 9.5 L9.8 1 H0.2 Z' } as const;

/**
 * The live state of the next departure: its status dot, which turns into a triangle for a moment when the
 * delay grows (red, pointing up) or shrinks (green, pointing down).
 */
export const LiveIndicator = ({ status, trend }: { status: LiveStatus; trend: 'up' | 'down' | null }) => (
    <span aria-hidden="true" className="grid size-3 shrink-0 place-items-center">
        <AnimatePresence mode="wait" initial={false}>
            {trend ? (
                <motion.svg
                    key={trend}
                    viewBox="0 0 10 10"
                    className={cn("size-2.5", trend === 'up' ? "fill-destructive" : "fill-emerald-600 dark:fill-emerald-400")}
                    initial={{ scale: 0, rotate: trend === 'up' ? -90 : 90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <path d={TRIANGLE[trend]} />
                </motion.svg>
            ) : (
                <motion.span key="dot" className="grid place-items-center" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.2 }}>
                    <LiveSignal status={status} />
                </motion.span>
            )}
        </AnimatePresence>
    </span>
);
