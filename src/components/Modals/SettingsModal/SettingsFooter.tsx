import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, RefreshCw, Download, Clock, Scale, MessageSquareHeart, ShieldCheck, FileText } from 'lucide-react';
import { version } from '../../../../package.json';
import { usePWAStore } from '@/state/pwaStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useUiStore } from '@/state/uiStore';
import { useStops } from '@/hooks/data/useStops';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemMedia } from '@/components/ui/item';
import { RowText } from './SettingsControls';
import { UI_TIMING_MS } from '@/config/constants';
import { formatDateTime } from '@/domain/time';
import { paths } from '@/lib/routes';

const LEGAL_LINKS = [
    { href: paths.privacy, label: 'legal.links.privacy', icon: ShieldCheck },
    { href: paths.terms, label: 'legal.links.terms', icon: FileText },
    { href: paths.licenses, label: 'legal.links.licenses', icon: Scale },
] as const;

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
        <>
            <Card size="none">
                {searchHistory.length > 0 && (
                    <Item
                        variant="row"
                        size="none"
                        render={<button onClick={() => { clearHistory(); toast.success(t('settings.clearHistory.success')); }} />}
                    >
                        <ItemMedia variant="rowIcon" className="text-destructive"><Clock strokeWidth={1.75} /></ItemMedia>
                        <RowText title={t('settings.clearHistory.button')} />
                    </Item>
                )}
                <Item
                    variant="row"
                    size="none"
                    render={<button onClick={() => { setIsSettingsOpen(false); setTimeout(() => setIsFeedbackOpen(true), UI_TIMING_MS.MODAL_SWAP_DELAY); }} />}
                >
                    <ItemMedia variant="rowIcon" className="text-muted-foreground"><MessageSquareHeart strokeWidth={1.75} /></ItemMedia>
                    <RowText title={t('feedback.title')} />
                    <ChevronRight size={17} strokeWidth={1.75} className="shrink-0 text-label-3" aria-hidden="true" />
                </Item>
                {canInstall && (
                    <Item variant="row" size="none" render={<button onClick={() => { void promptInstall(); }} />}>
                        <ItemMedia variant="rowIcon" className="text-muted-foreground"><Download strokeWidth={1.75} /></ItemMedia>
                        <RowText title={t('settings.install')} />
                    </Item>
                )}
                <Item
                    variant="row"
                    size="none"
                    className={cn(isChecking && "opacity-50 pointer-events-none")}
                    render={<button onClick={handleCheckUpdate} disabled={isChecking} />}
                >
                    <ItemMedia variant="rowIcon" className={cn("text-muted-foreground", isChecking && "animate-spin text-tint-mint")}>
                        <RefreshCw strokeWidth={1.75} />
                    </ItemMedia>
                    <RowText title={isChecking ? t('settings.updates.checking') : t('settings.updates.check')} />
                    <ItemActions className="type-meta text-muted-foreground tabular-nums">
                        {t('settings.versionBadge', { version })}
                    </ItemActions>
                </Item>
            </Card>

            <Card size="none">
                {LEGAL_LINKS.map(({ href, label, icon: Icon }) => (
                    <Item key={href} variant="row" size="none" render={<a href={href} target="_blank" rel="noopener" />}>
                        <ItemMedia variant="rowIcon" className="text-muted-foreground"><Icon strokeWidth={1.75} /></ItemMedia>
                        <RowText title={t(label)} />
                    </Item>
                ))}
            </Card>

            {updatedAt && (
                <p className="-mt-2 text-center type-note text-muted-foreground">
                    {t('settings.lastStopUpdate', { date: formatDateTime(updatedAt, i18n.resolvedLanguage) })}
                </p>
            )}
        </>
    );
};
