import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { secondsUntilRefresh, useSystemStatus } from '@/hooks/derived/useSystemStatus';
import { useCityConfig } from '@/hooks/data/useCities';
import { useNow } from '@/hooks/useNow';
import { usePreferencesStore } from '@/state/preferencesStore';
import { RefreshIntervalPicker } from '@/components/RefreshIntervalPicker';
import { cn } from '@/lib/cn';
import { ExternalLinkIcon } from '@/components/ExternalLinkIcon';
import { 
    Wifi, 
    WifiOff, 
    Database, 
    Activity, 
    Info, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle,
    RefreshCw,
    Timer
} from 'lucide-react';

interface SystemStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/** The modal's body; mounted only while the dialog is open, so its clock and subscriptions stop when closed. */
const SystemStatusDetails = () => {
    const { t } = useTranslation();
    const cityConfig = useCityConfig();
    const status = useSystemStatus();
    const now = useNow();
    const refreshIntervalS = usePreferencesStore(s => s.refreshIntervalS);
    const nextRefreshIn = secondsUntilRefresh(status.dataUpdatedAt, now, refreshIntervalS);

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

    const getStatusDetails = () => {
        switch (status.type) {
            case 'offline':
                return {
                    label: t('liveStatus.offline'),
                    description: t('liveStatus.offlineDesc'),
                    color: 'text-muted-foreground bg-fill',
                    icon: <WifiOff className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                };
            case 'app_error':
                return {
                    label: t('liveStatus.appError'),
                    description: t('liveStatus.statusErrorDesc'),
                    color: 'text-destructive bg-destructive/10',
                    icon: <XCircle className="w-5 h-5 text-destructive" strokeWidth={1.5} />
                };
            case 'upstream_offline':
                return {
                    label: t('liveStatus.upstreamError'),
                    description: t('liveStatus.upstreamErrorDesc'),
                    color: 'text-tint-amber bg-tint-amber/10',
                    icon: <AlertTriangle className="w-5 h-5 text-tint-amber" strokeWidth={1.5} />
                };
            case 'stale':
                return {
                    label: t('liveStatus.stale'),
                    description: t('liveStatus.statusStaleDesc'),
                    color: 'text-tint-amber bg-tint-amber/10',
                    icon: <AlertTriangle className="w-5 h-5 text-tint-amber" strokeWidth={1.5} />
                };
            case 'refreshing':
                return {
                    label: t('liveStatus.refreshing'),
                    description: t('liveStatus.refreshingDesc'),
                    color: 'text-tint-amber bg-tint-amber/10',
                    icon: <RefreshCw className="w-5 h-5 text-tint-amber animate-spin" strokeWidth={1.5} />
                };
            case 'healthy':
            default:
                return {
                    label: t('liveStatus.statusOk'),
                    description: t('liveStatus.statusOkDesc'),
                    color: 'text-tint-mint bg-tint-mint/10',
                    icon: <CheckCircle2 className="w-5 h-5 text-tint-mint" strokeWidth={1.5} />
                };
        }
    };

    const statusDetails = getStatusDetails();
    const providerName = t(cityConfig.dataProvider.nameKey);
    const providerUrl = cityConfig.dataProvider.url;

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-tint-mint" strokeWidth={1.5} />
                    {t('liveStatus.modalTitle')}
                </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3">
                <div className={cn("flex items-start gap-3 p-3.5 rounded-surface", statusDetails.color)}>
                    <span className="shrink-0 pt-0.5">{statusDetails.icon}</span>
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="type-row text-foreground">{statusDetails.label}</span>
                        <p className="type-note text-muted-foreground">{statusDetails.description}</p>
                    </div>
                </div>

                <Card size="none">
                        <Item variant="row" size="none" >
                            <ItemMedia variant="rowIcon" className="text-muted-foreground">
                                {status.isOnline ? <Wifi strokeWidth={1.5} /> : <WifiOff strokeWidth={1.5} />}
                            </ItemMedia>
                            <ItemContent className="flex-none">
                                <ItemTitle className="type-row text-foreground whitespace-nowrap">{t('liveStatus.connection')}</ItemTitle>
                            </ItemContent>
                            <ItemActions className={cn("ml-auto type-row", status.isOnline ? "text-tint-mint" : "text-destructive")}>
                                {status.isOnline ? t('liveStatus.online') : t('liveStatus.offline')}
                            </ItemActions>
                        </Item>

                        <Item variant="row" size="none" render={<a href={providerUrl} target="_blank" rel="noopener noreferrer" />}>
                            <ItemMedia variant="rowIcon" className="text-muted-foreground">
                                <Database strokeWidth={1.5} />
                            </ItemMedia>
                            <ItemContent className="flex-none">
                                <ItemTitle className="type-row text-foreground whitespace-nowrap">{t('liveStatus.dataProvider')}</ItemTitle>
                            </ItemContent>
                            <ItemActions className="flex-1 justify-end type-row min-w-0">
                                <span className="truncate">{providerName}</span>
                                <ExternalLinkIcon />
                            </ItemActions>
                        </Item>

                        <Item variant="row" size="none" >
                            <ItemMedia variant="rowIcon" className="text-muted-foreground">
                                <RefreshCw strokeWidth={1.5} />
                            </ItemMedia>
                            <ItemContent className="flex-none">
                                <ItemTitle className="type-row text-foreground whitespace-nowrap">{t('liveStatus.dataFreshness')}</ItemTitle>
                            </ItemContent>
                            <ItemActions className="ml-auto type-row tabular-nums gap-1.5 whitespace-nowrap">
                                <span className="font-semibold">{freshnessText}</span>
                                {!status.isFetching && (
                                    <span className="type-note text-muted-foreground">
                                        · {t('liveStatus.nextRefreshIn', { seconds: nextRefreshIn })}
                                    </span>
                                )}
                            </ItemActions>
                        </Item>

                        <Item variant="row" size="none" >
                            <ItemMedia variant="rowIcon" className="text-muted-foreground">
                                <Timer strokeWidth={1.5} />
                            </ItemMedia>
                            <ItemContent className="flex-none">
                                <ItemTitle className="type-row text-foreground whitespace-nowrap">{t('liveStatus.refreshInterval')}</ItemTitle>
                            </ItemContent>
                            <ItemActions className="ml-auto">
                                <RefreshIntervalPicker />
                            </ItemActions>
                        </Item>
                    </Card>

                <p className="flex gap-2 px-1 type-note text-muted-foreground">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-px" strokeWidth={1.5} />
                    {t('liveStatus.explanationText', { seconds: refreshIntervalS })}
                </p>
            </div>
        </>
    );
};

export const SystemStatusModal = memo(({ isOpen, onClose }: SystemStatusModalProps) => (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent aria-describedby={undefined} className="h-auto max-w-105 p-5 gap-4!">
            <SystemStatusDetails />
        </DialogContent>
    </Dialog>
));

SystemStatusModal.displayName = 'SystemStatusModal';
