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
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        drag="y"
                        dragConstraints={{ top: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 100) onClose();
                        }}
                        className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
                    >
                        {/* Handle Bar */}
                        <div className="flex justify-center p-3 cursor-grab active:cursor-grabbing">
                            <div className="w-12 h-1.5 bg-white/10 rounded-full" />
                        </div>

                        {/* Header */}
                        {(title) && (
                            <div className="px-6 pb-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white pr-4 truncate">
                                    {title}
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        )}

                        {/* Content */}
                        <div
                            className="flex-1 overflow-y-auto px-6 pb-8 custom-scrollbar"
                            style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
                        >
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
