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
                    {/* Sheet / Sidebar */}
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
                        className="fixed left-0 right-0 z-50 bg-black/95 backdrop-blur-lg md:backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden bottom-0 rounded-t-[32px] border-t border-white/10 md:top-4 md:left-4 md:bottom-4 md:right-auto md:w-[420px] md:rounded-[32px] md:border will-change-transform h-[92%] md:h-auto"
                    >
                        {/* Drag Handle: Explicitly for dragging the whole sheet */}
                        <div
                            className="flex flex-col shrink-0 pt-2.5 pb-2 cursor-grab active:cursor-grabbing touch-none"
                            onPointerDown={(e) => {
                                if (!(e.target as HTMLElement).closest('button')) {
                                    dragControls.start(e);
                                }
                            }}
                        >
                            <div className="flex justify-center md:hidden group py-1">
                                <div className="w-12 h-1 bg-white/10 group-hover:bg-white/20 rounded-full transition-colors" />
                            </div>

                            {/* Header */}
                            <div className="px-6 py-2 md:pt-6 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2 min-w-0">
                                    {onBack && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={onBack}
                                            className="h-9 w-9 -ml-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-all active:scale-95 shrink-0"
                                        >
                                            <ArrowLeft size={20} />
                                        </Button>
                                    )}
                                    <div className="flex items-center gap-2 min-w-0">
                                        <h2 className="text-xl font-bold text-white truncate tracking-tight">
                                            {title || ''}
                                        </h2>
                                        {platformCode && (
                                            <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 border border-white/5 text-zinc-400 text-[13px] font-black tabular-nums">
                                                {platformCode}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="h-9 w-9 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-all active:scale-95 shrink-0"
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
