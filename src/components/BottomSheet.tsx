import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    const [sheetState, setSheetState] = useState<'peek' | 'full'>('peek');

    // Reset snap point when opening
    useEffect(() => {
        if (isOpen) {
            setSheetState(isMobile ? 'peek' : 'full');
        }
    }, [isOpen, isMobile]);

    const variants = {
        hidden: isMobile
            ? { y: '100dvh', height: '50dvh' }
            : { x: '-110%', y: 0, height: 'auto' },
        peek: {
            y: 0,
            x: 0,
            height: isMobile ? '50dvh' : 'auto'
        },
        full: {
            y: 0,
            x: 0,
            height: isMobile ? '92dvh' : 'auto'
        },
    };

    const handleDragEnd = (_: any, info: any) => {
        if (!isMobile) return;
        const velocity = info.velocity.y;
        const offset = info.offset.y;

        if (sheetState === 'peek') {
            if (offset > 150 || velocity > 500) onClose();
            else if (offset < -150 || velocity < -500) setSheetState('full');
        } else {
            if (offset > 150 || velocity > 500) setSheetState('peek');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 md:hidden pointer-events-none"
                    />

                    {/* Sheet / Sidebar */}
                    <motion.div
                        initial="hidden"
                        animate={isMobile ? sheetState : "full"}
                        exit="hidden"
                        variants={variants}
                        transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 0.8 }}
                        drag={isMobile ? "y" : false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.05}
                        onDragEnd={handleDragEnd}
                        className="fixed left-0 right-0 z-50 bg-black/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden bottom-0 rounded-t-[32px] border-t border-white/10 md:top-4 md:left-4 md:bottom-4 md:right-auto md:w-[420px] md:rounded-[32px] md:border"
                    >
                        {/* Drag Handle: Explicitly for dragging the whole sheet */}
                        <div className="flex flex-col shrink-0 pt-2.5 pb-2">
                            <div className="flex justify-center md:hidden cursor-grab active:cursor-grabbing group py-1">
                                <div className="w-12 h-1 bg-white/10 group-hover:bg-white/20 rounded-full transition-colors" />
                            </div>

                            {/* Header */}
                            {title && (
                                <div className="px-6 py-2 md:pt-6 flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-white pr-4 truncate tracking-tight">
                                        {title}
                                    </h2>
                                    <button
                                        onClick={onClose}
                                        className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-all active:scale-95"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Content: ALWAYS scrollable since height is now constrained to screen */}
                        <div
                            className="flex-1 overflow-y-auto px-6 pb-20 custom-scrollbar overscroll-contain touch-pan-y"
                            style={{
                                paddingBottom: isMobile ? 'calc(5rem + env(safe-area-inset-bottom, 0px))' : '2rem'
                            }}
                        >
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
