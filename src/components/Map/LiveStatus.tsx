import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouteParams } from '../../hooks/useRouteParams';
import { useViewportStore } from '../../state/viewportStore';
import { useSystemStatus } from '../../hooks/derived/useSystemStatus';
import { TRANSIT_REFRESH_S } from '../../config/constants';
import { cn } from '@/lib/utils';
import { SystemStatusModal } from '../Modals/SystemStatusModal';

/**
 * LiveStatus Component
 *
 * Uses semantic components and standardized layout.
 */
export const LiveStatus: React.FC = () => {
    const { t } = useTranslation();
    const { stopId: selectedStopId, vehicleId: selectedVehicleId } = useRouteParams();
    const bounds = useViewportStore(s => s.bounds);
    const status = useSystemStatus();

    const isSidebarOpen = !!selectedStopId || !!selectedVehicleId;
    const [nextRefreshIn, setNextRefreshIn] = useState(TRANSIT_REFRESH_S);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const calculateRemaining = () => {
            const now = Date.now();
            const elapsed = Math.floor((now - status.dataUpdatedAt) / 1000);
            const remaining = Math.max(0, TRANSIT_REFRESH_S - elapsed);
            setNextRefreshIn(remaining);
        };

        calculateRemaining();
        const timer = setInterval(calculateRemaining, 1000);
        return () => clearInterval(timer);
    }, [status.dataUpdatedAt]);

    if (!bounds) return null;

    return (
        <div
            data-testid="live-status"
            className={cn(
                "absolute z-50 pointer-events-none -translate-x-1/2 left-1/2 top-0",
                "pt-[calc(4.75rem+env(safe-area-inset-top,0))] transition-all duration-300 ease-in-out md:p-0 md:top-[calc(5.25rem+env(safe-area-inset-top,0))]",
                isSidebarOpen && "md:left-(--visible-center-x)"
            )}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key="live-pill"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="pointer-events-auto"
                >
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="glassy px-3 py-1.5 rounded-full cursor-pointer hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 flex items-center"
                    >
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "w-2 h-2 rounded-full transition-colors duration-500",
                                status.type === 'offline' ? "bg-neutral-500" :
                                    status.type === 'app_error' ? "bg-destructive shadow-[0_0_8px_var(--color-destructive)]" :
                                        status.type === 'upstream_offline' ? "bg-orange-500 shadow-[0_0_8px_var(--color-orange-500)]" :
                                            status.type === 'stale' ? "bg-amber-500 shadow-[0_0_8px_var(--color-amber-500)]" :
                                                status.type === 'refreshing' ? "bg-amber-500 animate-pulse" : "bg-primary shadow-[0_0_8px_var(--color-primary)]"
                            )} />
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                                {status.type === 'offline' ? (
                                    <span className="text-neutral-500">{t('liveStatus.offline')}</span>
                                ) : status.type === 'app_error' ? (
                                    <span className="text-destructive">{t('liveStatus.appError')}</span>
                                ) : status.type === 'upstream_offline' ? (
                                    <span className="text-orange-500">{t('liveStatus.upstreamError')}</span>
                                ) : status.type === 'stale' ? (
                                    <span className="text-amber-500">{t('liveStatus.stale')}</span>
                                ) : status.type === 'refreshing' ? (
                                    <span className="text-amber-500">{t('liveStatus.refreshing')}</span>
                                ) : (
                                    <>
                                        <span className="text-primary">{t('liveStatus.live')}</span>
                                        <span className="text-muted-foreground/60 tabular-nums">{nextRefreshIn}s</span>
                                    </>
                                )}
                            </span>
                        </div>
                    </button>
                </motion.div>
            </AnimatePresence>

            <SystemStatusModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                nextRefreshIn={nextRefreshIn}
            />
        </div>
    );
};

LiveStatus.displayName = 'LiveStatus';
