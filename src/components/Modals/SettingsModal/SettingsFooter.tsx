import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download, Clock, Scale, MessageSquareHeart, ShieldCheck, FileText } from 'lucide-react';
import { version } from '../../../../package.json';
import { usePWAStore } from '@/state/pwaStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useUiStore } from '@/state/uiStore';
import { useStops } from '@/hooks/data/useStops';
import { toast } from 'sonner';
import { cn } from 'cn';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ItemGroup, Item, ItemMedia, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item';
import { UI_TIMING_MS } from '@/config/constants';
import { formatDateTime } from '@/domain/time';
import { paths } from '@/lib/routes';

export const SettingsFooter = () => {
    const { t, i18n } = useTranslation();

    const searchHistory = usePreferencesStore(s => s.searchHistory);
    const { clearHistory } = usePreferencesStore(s => s.actions);
    const { setIsFeedbackOpen, setIsSettingsOpen } = useUiStore(s => s.actions);

    const { updatedAt } = useStops();
    const [isChecking, setIsChecking] = useState(false);

    const needRefresh = usePWAStore(s => s.needRefresh);
    const canInstall = usePWAStore(s => s.canInstall);
    const { promptInstall } = usePWAStore(s => s.actions);

    useEffect(() => {
        if (needRefresh && isChecking) {
            const timer = setTimeout(() => setIsChecking(false), 0);
            return () => clearTimeout(timer);
        }
    }, [needRefresh, isChecking]);

    const handleCheckUpdate = async () => {
        if (isChecking) return;

        if (needRefresh) {
            return;
        }

        setIsChecking(true);

        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();
                    
                    // No update prompt within the wait means this version is current.
                    setTimeout(() => {
                        setIsChecking((currentChecking) => {
                            if (currentChecking) {
                                toast.success(t('settings.updates.upToDate'));
                                return false;
                            }
                            return false;
                        });
                    }, UI_TIMING_MS.UPDATE_CHECK_WAIT);
                    return;
                }
            }
        } catch (error) {
            console.error('Update check failed', error);
        }
        
        setIsChecking(false);
        toast.success(t('settings.updates.upToDate'));
    };

    return (
        <div className="flex flex-col gap-6">
            <Card variant="subtle" size="none" className="overflow-hidden gap-0">
                <ItemGroup className="gap-0">
                    {searchHistory.length > 0 && (
                        <Item
                            variant="settings"
                            size="none"
                            render={<button onClick={() => { clearHistory(); toast.success(t('settings.clearHistory.success')); }} />}
                        >
                            <ItemMedia variant="icon" className="text-destructive">
                                <Clock size={18} strokeWidth={2} />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle className="text-foreground">{t('settings.clearHistory.button')}</ItemTitle>
                            </ItemContent>
                        </Item>
                    )}
                    <Item
                        variant="settings"
                        size="none"
                        render={<button onClick={() => { setIsSettingsOpen(false); setTimeout(() => setIsFeedbackOpen(true), UI_TIMING_MS.MODAL_SWAP_DELAY); }} />}
                    >
                        <ItemMedia variant="icon" className="text-primary">
                            <MessageSquareHeart size={18} strokeWidth={2} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">{t('feedback.title')}</ItemTitle>
                        </ItemContent>
                    </Item>

                    {canInstall && (
                        <Item
                            variant="settings"
                            size="none"
                            render={<button onClick={() => { void promptInstall(); }} />}
                        >
                            <ItemMedia variant="icon" className="text-primary">
                                <Download size={18} strokeWidth={2} />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle className="text-foreground">{t('settings.install')}</ItemTitle>
                            </ItemContent>
                        </Item>
                    )}

                    <Item
                        variant="settings"
                        size="none"
                        className={cn(isChecking && "opacity-50 pointer-events-none")}
                        render={<button onClick={handleCheckUpdate} disabled={isChecking} />}
                    >
                        <ItemMedia variant="icon" className={cn("text-muted-foreground", isChecking && "animate-spin text-primary")}>
                            <RefreshCw size={18} strokeWidth={2} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">
                                {isChecking ? t('settings.updates.checking') : t('settings.updates.check')}
                            </ItemTitle>
                        </ItemContent>
                        <ItemActions>
                            <Badge variant="label">
                                {t('settings.versionBadge', { version })}
                            </Badge>
                        </ItemActions>
                    </Item>
                </ItemGroup>
            </Card>

            <Card variant="subtle" size="none" className="overflow-hidden gap-0">
                <ItemGroup className="gap-0">
                    <Item variant="settings" size="none" render={<a href={paths.privacy} target="_blank" rel="noopener" />}>
                        <ItemMedia variant="icon" className="text-muted-foreground">
                            <ShieldCheck size={18} strokeWidth={2} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">{t('legal.links.privacy')}</ItemTitle>
                        </ItemContent>
                    </Item>
                    <Item variant="settings" size="none" render={<a href={paths.terms} target="_blank" rel="noopener" />}>
                        <ItemMedia variant="icon" className="text-muted-foreground">
                            <FileText size={18} strokeWidth={2} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">{t('legal.links.terms')}</ItemTitle>
                        </ItemContent>
                    </Item>
                    <Item variant="settings" size="none" render={<a href={paths.licenses} target="_blank" rel="noopener" />}>
                        <ItemMedia variant="icon" className="text-muted-foreground">
                            <Scale size={18} strokeWidth={2} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">{t('legal.links.licenses')}</ItemTitle>
                        </ItemContent>
                    </Item>
                </ItemGroup>
            </Card>

            {updatedAt && (
                <div className="text-[10px] text-muted-foreground/30 font-medium text-center pb-2 px-6">
                    {t('settings.lastStopUpdate', { date: formatDateTime(updatedAt, i18n.resolvedLanguage) })}
                </div>
            )}
        </div>
    );
};
