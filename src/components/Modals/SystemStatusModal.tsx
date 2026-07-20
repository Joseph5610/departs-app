import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useSystemStatus } from '../../hooks/derived/useSystemStatus';
import { DATA_SOURCE_URLS } from '../../config/constants';
import { cn } from '@/lib/utils';
import { 
    Wifi, 
    WifiOff, 
    Database, 
    MapPin, 
    Activity, 
    Info, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle,
    RefreshCw,
    ExternalLink
} from 'lucide-react';

interface SystemStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    nextRefreshIn: number;
}

export const SystemStatusModal: React.FC<SystemStatusModalProps> = ({ isOpen, onClose, nextRefreshIn }) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const status = useSystemStatus();

    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Format data freshness
    const freshnessText = (() => {
        if (!status.dataUpdatedAt) return '-';
        const diffSeconds = Math.max(0, Math.floor((now - status.dataUpdatedAt) / 1000));
        
        if (diffSeconds < 5) {
            return t('liveStatus.justNow');
        } else if (diffSeconds < 60) {
            return t('liveStatus.secondsAgo', { seconds: diffSeconds });
        } else {
            const diffMinutes = Math.floor(diffSeconds / 60);
            return t('liveStatus.minutesAgo', { minutes: diffMinutes });
        }
    })();

    // Determine status badge/color based on unified status type
    const getStatusDetails = () => {
        switch (status.type) {
            case 'offline':
                return {
                    label: t('liveStatus.offline'),
                    description: t('liveStatus.offlineDesc'),
                    color: 'text-neutral-500 bg-neutral-500/10 border-neutral-500/20',
                    dotColor: 'bg-neutral-500',
                    icon: <WifiOff className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
                };
            case 'app_error':
                return {
                    label: t('liveStatus.appError'),
                    description: t('liveStatus.statusErrorDesc'),
                    color: 'text-destructive bg-destructive/10 border-destructive/20',
                    dotColor: 'bg-destructive',
                    icon: <XCircle className="w-5 h-5 text-destructive" strokeWidth={1.5} />
                };
            case 'upstream_offline':
                return {
                    label: t('liveStatus.upstreamError'),
                    description: t('liveStatus.upstreamErrorDesc'),
                    color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
                    dotColor: 'bg-orange-500',
                    icon: <AlertTriangle className="w-5 h-5 text-orange-500" strokeWidth={1.5} />
                };
            case 'stale':
                return {
                    label: t('liveStatus.stale'),
                    description: t('liveStatus.statusStaleDesc'),
                    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
                    dotColor: 'bg-amber-500',
                    icon: <AlertTriangle className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
                };
            case 'refreshing':
                return {
                    label: t('liveStatus.refreshing'),
                    description: t('liveStatus.refreshingDesc'),
                    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
                    dotColor: 'bg-amber-500 animate-pulse',
                    icon: <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" strokeWidth={1.5} />
                };
            case 'healthy':
            default:
                return {
                    label: t('liveStatus.statusOk'),
                    description: t('liveStatus.statusOkDesc'),
                    color: 'text-primary bg-primary/10 border-primary/20',
                    dotColor: 'bg-primary shadow-[0_0_8px_var(--color-primary)]',
                    icon: <CheckCircle2 className="w-5 h-5 text-primary" strokeWidth={1.5} />
                };
        }
    };

    const statusDetails = getStatusDetails();
    const providerName = selectedCity === 'brno' 
        ? t('liveStatus.providerKordis') 
        : t('liveStatus.providerGolemio');
    
    const providerUrl = selectedCity === 'brno' ? DATA_SOURCE_URLS.brno : DATA_SOURCE_URLS.prague;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent aria-describedby={undefined} variant="default" className="h-auto max-w-[420px] p-6 gap-6!">
                <DialogHeader className="pt-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" strokeWidth={1.5} />
                        {t('liveStatus.modalTitle')}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-5">
                    {/* Status Overview Card */}
                    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-border/50 bg-card shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {statusDetails.icon}
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('liveStatus.status')}</span>
                                    <span className="text-sm font-bold tracking-tight">{statusDetails.label}</span>
                                </div>
                            </div>
                            <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5", statusDetails.color)}>
                                <div className={cn("w-1.5 h-1.5 rounded-full", statusDetails.dotColor)} />
                                {status.isOnline ? 'Online' : 'Offline'}
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed pt-3 border-t border-border/50">
                            {statusDetails.description}
                        </p>
                    </div>

                    {/* Technical Info Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1 p-3.5 rounded-2xl border border-border/50 bg-card shadow-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <Wifi className="w-3.5 h-3.5" strokeWidth={1.5} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{t('liveStatus.connection')}</span>
                            </div>
                            <span className={cn("text-sm font-semibold", status.isOnline ? "text-green-500" : "text-destructive")}>
                                {status.isOnline ? t('liveStatus.online') : t('liveStatus.offline')}
                            </span>
                        </div>

                        <div className="flex flex-col gap-1 p-3.5 rounded-2xl border border-border/50 bg-card shadow-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{t('liveStatus.region')}</span>
                            </div>
                            <span className="text-sm font-semibold capitalize">
                                {selectedCity}
                            </span>
                        </div>

                        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/50 bg-card shadow-sm col-span-2">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                    <Database className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('liveStatus.dataProvider')}</span>
                                </div>
                                <span className="text-sm font-semibold">
                                    {providerName}
                                </span>
                            </div>
                            <a 
                                href={providerUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 bg-foreground/5 hover:bg-foreground/10 px-2.5 py-1.5 rounded-lg border border-border/50 font-bold"
                            >
                                {t('liveStatus.dataProviderLink')}
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>

                        <div className="flex flex-col gap-1 p-3.5 rounded-2xl border border-border/50 bg-card shadow-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{t('liveStatus.dataFreshness')}</span>
                            </div>
                            <span className="text-sm font-semibold tabular-nums">
                                {freshnessText}
                            </span>
                        </div>

                        <div className="flex flex-col gap-1 p-3.5 rounded-2xl border border-border/50 bg-card shadow-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <Activity className="w-3.5 h-3.5" strokeWidth={1.5} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{t('liveStatus.nextRefresh')}</span>
                            </div>
                            <span className="text-sm font-semibold tabular-nums">
                                {status.isFetching ? '-' : `${nextRefreshIn}s`}
                            </span>
                        </div>
                    </div>

                    {/* How It Works Info Card */}
                    <div className="flex gap-3 p-4 rounded-2xl border border-primary/30 bg-primary/10 shadow-sm text-xs leading-relaxed text-muted-foreground">
                        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-foreground">{t('liveStatus.explanationTitle')}</span>
                            <span>{t('liveStatus.explanationText')}</span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

SystemStatusModal.displayName = 'SystemStatusModal';
