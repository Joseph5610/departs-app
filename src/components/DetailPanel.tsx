import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';
import { MOBILE_BREAKPOINT } from '../config/constants';
import { Button } from "@/components/ui/button";

interface DetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    title?: string;
    platformCode?: string;
    children: React.ReactNode;
}

type SheetState = 'collapsed' | 'peek' | 'full';

export const DetailPanel: React.FC<DetailPanelProps> = React.memo(({ isOpen, onClose, onBack, title, platformCode, children }) => {
    const dragControls = useDragControls();
    const contentRef = useRef<HTMLDivElement>(null);

    // Use a reactive window size
    const [windowSize, setWindowSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1024,
        height: typeof window !== 'undefined' ? window.innerHeight : 800
    });

    useEffect(() => {
        const handleResize = () => setWindowSize({
            width: window.innerWidth,
            height: window.innerHeight
        });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowSize.width < MOBILE_BREAKPOINT;

    const [sheetState, setSheetState] = useState<SheetState>(isMobile ? 'peek' : 'full');
    const [prevIsMobile, setPrevIsMobile] = useState(isMobile);
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    // Derived state updates during render to avoid useEffect cascading renders
    if (isMobile !== prevIsMobile || isOpen !== prevIsOpen) {
        setPrevIsMobile(isMobile);
        setPrevIsOpen(isOpen);

        if (isOpen !== prevIsOpen && isOpen && isMobile) {
            setSheetState('peek');
        } else if (isMobile !== prevIsMobile) {
            setSheetState(isMobile ? 'peek' : 'full');
        }
    }

    const variants = useMemo(() => ({
        hidden: isMobile
            ? { y: '100%', x: 0 }
            : { x: '-110%', y: 0 },
        collapsed: {
            y: '85%',
            x: 0
        },
        peek: {
            y: '45%',
            x: 0
        },
        full: {
            y: '0%',
            x: 0
        },
    }), [isMobile]);

    const handleDragEnd = useCallback((_: unknown, info: { velocity: { y: number }; offset: { y: number } }) => {
        if (!isMobile) return;
        const { velocity, offset } = info;
      
        // Snapping logic with velocity projection
        const travel = offset.y + (velocity.y * 0.15);
        const threshold = 75;

        if (travel > threshold) {
            // Moving DOWN
            if (sheetState === 'full') setSheetState('peek');
            else if (sheetState === 'peek') setSheetState('collapsed');
            else onClose();
        } else if (travel < -threshold) {
            // Moving UP
            if (sheetState === 'collapsed') setSheetState('peek');
            else if (sheetState === 'peek') setSheetState('full');
        }
    }, [isMobile, sheetState, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial="hidden"
                        animate={isMobile ? sheetState : "full"}
                        exit="hidden"
                        variants={variants}
                        transition={{ type: 'spring', damping: 25, stiffness: 220, mass: 0.5 }}
                        drag={isMobile ? "y" : false}
                        dragControls={dragControls}
                        dragListener={false}
                        dragConstraints={{ top: 0, bottom: windowSize.height }}
                        dragElastic={0.05}
                        onDragEnd={handleDragEnd}
                        className="fixed inset-x-0 bottom-0 z-50 flex h-[92%] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-black/95 shadow-2xl backdrop-blur-lg will-change-transform md:top-4 md:left-4 md:bottom-4 md:right-auto md:h-auto md:w-[420px] md:rounded-3xl md:border md:backdrop-blur-2xl"
                    >
                        <div
                            className="flex shrink-0 cursor-grab flex-col pb-2 pt-2.5 touch-none active:cursor-grabbing"
                            onPointerDown={(e) => {
                                if (!(e.target as HTMLElement).closest('button')) {
                                    dragControls.start(e);
                                }
                            }}
                        >
                            <div className="group flex justify-center py-1 md:hidden">
                                <div className="h-1 w-12 rounded-full bg-white/10 transition-colors group-hover:bg-white/20" />
                            </div>

                            <div className="flex items-center justify-between gap-4 px-6 py-2 md:pt-6">
                                <div className="flex min-w-0 items-center gap-2">
                                    {onBack && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={onBack}
                                            className="h-9 w-9 -ml-2 rounded-full bg-white/5 text-zinc-400 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                                        >
                                            <ArrowLeft size={20} />
                                        </Button>
                                    )}
                                    <div className="flex min-w-0 items-center gap-2">
                                        <h2 className="truncate text-xl font-bold tracking-tight text-white">
                                            {title || ''}
                                        </h2>
                                        {platformCode && (
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/10 font-black tabular-nums text-[13px] text-zinc-400">
                                                {platformCode}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="h-9 w-9 rounded-full bg-white/5 text-zinc-400 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                                >
                                    <X size={20} />
                                </Button>
                            </div>
                        </div>

                        {/* Content: ALWAYS scrollable since height is now constrained to screen */}
                        <motion.div
                            ref={contentRef}
                            initial={false}
                            animate={{
                                paddingBottom: (isMobile && sheetState === 'peek') ? '41.4vh' : '0px'
                            }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220, mass: 0.5 }}
                            className={`flex-1 px-6 custom-scrollbar overscroll-contain touch-pan-y ${
                                (isMobile && sheetState === 'collapsed') ? 'overflow-hidden' : 'overflow-y-auto'
                            }`}
                        >
                            <div className="pb-[env(safe-area-inset-bottom,1.5rem)]">
                                {children}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
});
