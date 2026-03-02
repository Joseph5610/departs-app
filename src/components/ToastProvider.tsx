import React, { useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { ToastContext, type ToastType } from '../hooks/useToast';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

/**
 * Provides toast notification functionality to the application.
 * Centrally manages toast state and rendering with Framer Motion animations.
 */
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-24 left-4 right-4 z-[200] md:left-auto md:right-4 md:w-80 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 50, opacity: 0 }}
                            layout
                            className="pointer-events-auto bg-black/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3"
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 p-2 rounded-xl 
                                    ${toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' :
                                        toast.type === 'error' ? 'bg-red-500/20 text-red-500' :
                                            'bg-blue-500/20 text-blue-500'}`}>
                                    {toast.type === 'success' && <CheckCircle size={18} />}
                                    {toast.type === 'error' && <AlertCircle size={18} />}
                                    {toast.type === 'info' && <Info size={18} />}
                                </div>
                                <div className="flex flex-col justify-center min-h-[36px]">
                                    <span className="text-white text-sm font-medium leading-tight">
                                        {toast.message}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="p-3 -m-1.5 hover:bg-white/5 rounded-lg text-zinc-500 transition-colors self-start"
                            >
                                <X size={16} />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};
