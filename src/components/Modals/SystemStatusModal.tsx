import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { secondsUntilRefresh, useSystemStatus } from '@/hooks/derived/useSystemStatus';
import { useCityConfig } from '@/hooks/data/useCities';
import { useNow } from '@/hooks/useNow';
import { usePreferencesStore } from '@/state/preferencesStore';
import { RefreshIntervalPicker } from '@/components/RefreshIntervalPicker';
import { cn } from 'cn';
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
    ExternalLink,
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
                    color: 'text-neutral-500 bg-neutral-500/10 border-neutral-500/20',
                    icon: <WifiOff className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
                };
            case 'app_error':
                return {
                    label: t('liveStatus.appError'),
                    description: t('liveStatus.statusErrorDesc'),
                    color: 'text-destructive bg-destructive/10 border-destructive/20',
                    icon: <XCircle className="w-5 h-5 text-destructive" strokeWidth={1.5} />
                };
            case 'upstream_offline':
                return {
                    label: t('liveStatus.upstreamError'),
                    description: t('liveStatus.upstreamErrorDesc'),
                    color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
                    icon: <AlertTriangle className="w-5 h-5 text-orange-500" strokeWidth={1.5} />
                };
            case 'stale':
                return {
                    label: t('liveStatus.stale'),
                    description: t('liveStatus.statusStaleDesc'),
                    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
                    icon: <AlertTriangle className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
                };
            case 'refreshing':
                return {
                    label: t('liveStatus.refreshing'),
                    description: t('liveStatus.refreshingDesc'),
                    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
                    icon: <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" strokeWidth={1.5} />
                };
            case 'healthy':
            default:
                return {
                    label: t('liveStatus.statusOk'),
                    description: t('liveStatus.statusOkDesc'),
                    color: 'text-primary bg-primary/10 border-primary/20',
                    icon: <CheckCircle2 className="w-5 h-5 text-primary" strokeWidth={1.5} />
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
                    <Activity className="w-5 h-5 text-primary" strokeWidth={1.5} />
                    {t('liveStatus.modalTitle')}
                </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3">
                <div className={cn("flex items-start gap-3 p-3.5 rounded-2xl border", statusDetails.color)}>
                    <span className="shrink-0 pt-0.5">{statusDetails.icon}</span>
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold tracking-tight text-foreground">{statusDetails.label}</span>
                        <p className="text-xs text-muted-foreground leading-snug">{statusDetails.description}</p>
                    </div>
                </div>

                <Card variant="subtle" size="none" className="overflow-hidden gap-0">
                    <ItemGroup className="gap-0">
                        <Item variant="settings" size="none" className="flex-nowrap hover:bg-transparent active:bg-transparent">
                            <ItemMedia variant="icon" className="text-muted-foreground">
                                {status.isOnline ? <Wifi strokeWidth={1.5} /> : <WifiOff strokeWidth={1.5} />}
                            </ItemMedia>
                            <ItemContent className="flex-none">
                                <ItemTitle className="text-muted-foreground font-normal whitespace-nowrap">{t('liveStatus.connection')}</ItemTitle>
                            </ItemContent>
                            <ItemActions className={cn("ml-auto text-sm font-semibold", status.isOnline ? "text-green-500" : "text-destructive")}>
                                {status.isOnline ? t('liveStatus.online') : t('liveStatus.offline')}
                            </ItemActions>
                        </Item>

                        <Item variant="settings" size="none" className="flex-nowrap" render={<a href={providerUrl} target="_blank" rel="noopener noreferrer" />}>
                            <ItemMedia variant="icon" className="text-muted-foreground">
                                <Database strokeWidth={1.5} />
                            </ItemMedia>
                            <ItemContent className="flex-none">
                                <ItemTitle className="text-muted-foreground font-normal whitespace-nowrap">{t('liveStatus.dataProvider')}</ItemTitle>
                            </ItemContent>
                            <ItemActions className="flex-1 justify-end text-sm font-semibold min-w-0">
                                <span className="truncate">{providerName}</span>
                                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                            </ItemActions>
                        </Item>

                        <Item variant="settings" size="none" className="flex-nowrap hover:bg-transparent active:bg-transparent">
                            <ItemMedia variant="icon" className="text-muted-foreground">
                                <RefreshCw strokeWidth={1.5} />
                            </ItemMedia>
                            <ItemContent className="flex-none">
                                <ItemTitle className="text-muted-foreground font-normal whitespace-nowrap">{t('liveStatus.dataFreshness')}</ItemTitle>
                            </ItemContent>
                            <ItemActions className="ml-auto text-sm tabular-nums gap-1.5 whitespace-nowrap">
                                <span className="font-semibold">{freshnessText}</span>
                                {!status.isFetching && (
                                    <span className="text-xs text-muted-foreground">
                                        · {t('liveStatus.nextRefreshIn', { seconds: nextRefreshIn })}
                                    </span>
                                )}
                            </ItemActions>
                        </Item>

                        <Item variant="settings" size="none" className="flex-nowrap hover:bg-transparent active:bg-transparent">
                            <ItemMedia variant="icon" className="text-muted-foreground">
                                <Timer strokeWidth={1.5} />
                            </ItemMedia>
                            <ItemContent className="flex-none">
                                <ItemTitle className="text-muted-foreground font-normal whitespace-nowrap">{t('liveStatus.refreshInterval')}</ItemTitle>
                            </ItemContent>
                            <ItemActions className="ml-auto">
                                <RefreshIntervalPicker className="w-36" />
                            </ItemActions>
                        </Item>
                    </ItemGroup>
                </Card>

                <p className="flex gap-2 px-1 text-[11px] leading-snug text-muted-foreground">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-px" strokeWidth={1.5} />
                    {t('liveStatus.explanationText', { seconds: refreshIntervalS })}
                </p>
            </div>
        </>
    );
};

export const SystemStatusModal = memo(({ isOpen, onClose }: SystemStatusModalProps) => (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent aria-describedby={undefined} variant="default" className="h-auto max-w-105 p-5 gap-4!">
            <SystemStatusDetails />
        </DialogContent>
    </Dialog>
));

SystemStatusModal.displayName = 'SystemStatusModal';
