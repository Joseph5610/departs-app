import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouteParams } from '../../hooks/useRouteParams';
import { useViewportStore } from '../../state/viewportStore';
import { useSystemStatus } from '../../hooks/derived/useSystemStatus';
import { TRANSIT_REFRESH_S } from '../../config/constants';
import { cn } from '@/lib/utils';
import { SystemStatusModal } from '../Modals/SystemStatusModal';
import { usePreferencesStore } from '../../state/preferencesStore';
import { Filter } from 'lucide-react';

/**
 * LiveStatus Component
 *
 * Displays the real-time system connection status pill.
 */
export const LiveStatus: React.FC = () => {
    const { t } = useTranslation();
    const { stopId: selectedStopId, vehicleId: selectedVehicleId, isStatsRoute, isFavoritesRoute } = useRouteParams();
    const bounds = useViewportStore(s => s.bounds);
    const status = useSystemStatus();

    const isSidebarOpen = !!selectedStopId || !!selectedVehicleId || isStatsRoute || isFavoritesRoute;
    const isFiltered = usePreferencesStore(
        s => s.routeTypeFilter.length > 0 || s.delayFilter.length > 0 || s.stopTypeFilter.length > 0 || s.requireAirConditioned
    );
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

    const getConfig = () => {
        if (status.type === 'offline') return { text: t('liveStatus.offline'), color: 'text-neutral-500', dot: 'bg-neutral-500' };
        if (status.type === 'app_error') return { text: t('liveStatus.appError'), color: 'text-destructive', dot: 'bg-destructive shadow-[0_0_8px_var(--color-destructive)]' };
        if (status.type === 'upstream_offline') return { text: t('liveStatus.upstreamError'), color: 'text-orange-500', dot: 'bg-orange-500 shadow-[0_0_8px_var(--color-orange-500)]' };
        if (status.type === 'stale') return { text: t('liveStatus.stale'), color: 'text-amber-500', dot: 'bg-amber-500 shadow-[0_0_8px_var(--color-amber-500)]' };
        if (status.type === 'refreshing') return { text: t('liveStatus.refreshing'), color: 'text-amber-500', dot: 'bg-amber-500 animate-pulse' };
        if (isFiltered) return {
            text: t('liveStatus.filtered', 'FILTERED'),
            color: 'text-purple-400',
            dot: 'bg-purple-500 shadow-[0_0_8px_var(--color-purple-500)]',
            icon: <Filter className="w-3 h-3 text-purple-400 shrink-0" />,
            showCountdown: true
        };
        return {
            text: t('liveStatus.live'),
            color: 'text-primary',
            dot: 'bg-primary shadow-[0_0_8px_var(--color-primary)]',
            showCountdown: true
        };
    };

    const config = getConfig();

    return (
        <div
            data-testid="live-status"
            className={cn(
                "absolute z-50 pointer-events-none -translate-x-1/2 left-1/2 top-0",
                "pt-[calc(4.75rem+env(safe-area-inset-top,0))] transition-all duration-300 ease-in-out md:p-0 md:top-[calc(5.25rem+env(safe-area-inset-top,0))]",
                isSidebarOpen && "md:left-(--visible-center-x)"
            )}
        >
            <div className="pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="glassy px-3 py-1.5 rounded-full cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 flex items-center"
                >
                    <div className="flex items-center gap-1.5 h-3">
                        <div className={cn("w-2 h-2 rounded-full transition-colors duration-500 shrink-0", config.dot)} />
                        
                        {config.icon}
                        
                        <div className="flex items-center gap-1.5 pt-[1px]">
                            <span className={cn("text-[9px] font-bold uppercase tracking-widest leading-none whitespace-nowrap", config.color)}>
                                {config.text}
                            </span>
                            {config.showCountdown && (
                                <span className="text-[9px] font-bold text-muted-foreground/60 tabular-nums leading-none">
                                    {nextRefreshIn}s
                                </span>
                            )}
                        </div>
                    </div>
                </button>
            </div>

            <SystemStatusModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                nextRefreshIn={nextRefreshIn}
            />
        </div>
    );
};

LiveStatus.displayName = 'LiveStatus';
