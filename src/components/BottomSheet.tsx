import React from 'react';
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

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop - Transparent and no blur on mobile to keep map visible */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 md:hidden pointer-events-none"
                    />

                    {/* Sheet / Sidebar */}
                    <motion.div
                        initial={isMobile ? { y: '100%', x: 0 } : { x: '-110%', y: 0 }}
                        animate={{ y: 0, x: 0 }}
                        exit={isMobile ? { y: '100%' } : { x: '-110%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                        {...(isMobile ? {
                            drag: "y",
                            dragConstraints: { top: 0 },
                            dragElastic: 0.2,
                            onDragEnd: (_, info) => {
                                if (info.offset.y > 100) onClose();
                            }
                        } : {})}
                        className="fixed bottom-0 left-0 right-0 md:top-4 md:left-4 md:bottom-4 md:right-auto z-50 bg-black/95 backdrop-blur-2xl border-t md:border border-white/10 rounded-t-[32px] md:rounded-[32px] shadow-2xl max-h-[85vh] md:max-h-none md:w-[420px] flex flex-col overflow-hidden"
                    >
                        {/* Handle Bar - Mobile only */}
                        <div className="flex justify-center p-2.5 md:hidden cursor-grab active:cursor-grabbing">
                            <div className="w-12 h-1 bg-white/10 rounded-full" />
                        </div>

                        {/* Header */}
                        {title && (
                            <div className="px-6 py-4 md:pt-8 flex items-center justify-between">
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

                        {/* Content */}
                        <div
                            className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar"
                            style={{
                                paddingBottom: isMobile ? 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' : '2rem'
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
