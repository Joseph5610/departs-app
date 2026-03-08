import React, { useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { ToastContext, type ToastType } from '../hooks/useToast';
import { cn } from '@/lib/utils';
import { Box, HStack } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';

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
            <Box className="fixed bottom-24 left-4 right-4 z-[200] md:left-auto md:right-4 md:w-80 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 50, opacity: 0 }}
                            layout
                        >
                            <HStack className="pointer-events-auto bg-background/95 backdrop-blur-xl border border-border p-4 rounded-2xl shadow-2xl justify-between gap-3">
                                <HStack className="items-start gap-3">
                                    <Box className={cn(
                                        "mt-0.5 p-2 rounded-xl",
                                        toast.type === 'success' ? 'bg-primary/20 text-primary' :
                                        toast.type === 'error' ? 'bg-destructive/20 text-destructive' :
                                        'bg-sky-500/20 text-sky-500'
                                    )}>
                                        {toast.type === 'success' && <CheckCircle size={18} />}
                                        {toast.type === 'error' && <AlertCircle size={18} />}
                                        {toast.type === 'info' && <Info size={18} />}
                                    </Box>
                                    <Box className="flex flex-col justify-center min-h-[36px]">
                                        <span className="text-foreground text-sm font-medium leading-tight">
                                            {toast.message}
                                        </span>
                                    </Box>
                                </HStack>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeToast(toast.id)}
                                    className="h-10 w-10 -m-1.5 text-muted-foreground self-start"
                                >
                                    <X size={16} />
                                </Button>
                            </HStack>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </Box>
        </ToastContext.Provider>
    );
};
