import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Clock, Database, Scale, MessageSquareHeart } from 'lucide-react';
import { version } from '../../../../package.json';
import { usePWAStore } from '../../../state/pwaStore';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useStops } from '../../../hooks/data/useStops';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ItemGroup, Item, ItemMedia, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item';
import { DATA_SOURCE_URLS } from '../../../config/constants';
import { formatDateTime } from '../../../utils/dateUtils';

export const SettingsFooter: React.FC = () => {
    const { t, i18n } = useTranslation();

    // Preferences
    const searchHistory = usePreferencesStore(s => s.searchHistory);
    const { clearHistory, setIsFeedbackOpen, setIsSettingsOpen } = usePreferencesStore(s => s.actions);

    const { updatedAt } = useStops();
    const [isChecking, setIsChecking] = useState(false);

    // PWA
    const needRefresh = usePWAStore(s => s.needRefresh);

    // Reset checking state if update is found
    React.useEffect(() => {
        if (needRefresh && isChecking) {
            const timer = setTimeout(() => setIsChecking(false), 0);
            return () => clearTimeout(timer);
        }
    }, [needRefresh, isChecking]);

    const handleCheckUpdate = async () => {
        if (isChecking) return;

        // If already need refresh, don't show another check
        if (needRefresh) {
            return;
        }

        setIsChecking(true);

        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();
                    
                    // Wait to see if needRefresh becomes true (meaning update was found)
                    // If not after 2.5 seconds, we assume we are up to date
                    setTimeout(() => {
                        setIsChecking((currentChecking) => {
                            if (currentChecking) {
                                toast.success(t('settings.updates.upToDate'));
                                return false;
                            }
                            return false;
                        });
                    }, 2500);
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
                        render={<button onClick={() => { setIsSettingsOpen(false); setTimeout(() => setIsFeedbackOpen(true), 150); }} />}
                    >
                        <ItemMedia variant="icon" className="text-primary">
                            <MessageSquareHeart size={18} strokeWidth={2} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">{t('feedback.title')}</ItemTitle>
                        </ItemContent>
                    </Item>

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
                            <Badge variant="outline" className="text-[10px] text-muted-foreground/70 border-border/40 bg-foreground/5 uppercase font-semibold tracking-wider">
                                {t('settings.versionBadge', { version })}
                            </Badge>
                        </ItemActions>
                    </Item>
                </ItemGroup>
            </Card>

            <div className="flex flex-col gap-2">
                <div className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest px-1">
                    {t('settings.sections.attributions')}
                </div>
                <Card variant="subtle" size="none" className="overflow-hidden gap-0">
                    <ItemGroup className="gap-0">
                        <Item
                            variant="settings"
                            size="none"
                            render={<a href={DATA_SOURCE_URLS.prague} target="_blank" rel="noopener noreferrer" />}
                        >
                            <ItemMedia variant="icon" className="text-muted-foreground">
                                <Database size={18} strokeWidth={2} />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle className="text-foreground">Golemio (Prague)</ItemTitle>
                            </ItemContent>
                            <ItemActions>
                                <Badge variant="outline" className="text-[10px] text-muted-foreground/70 border-border/40 bg-foreground/5 uppercase font-semibold tracking-wider">
                                    {t('settings.dataSource')}
                                </Badge>
                            </ItemActions>
                        </Item>

                        <Item
                            variant="settings"
                            size="none"
                            render={<a href={DATA_SOURCE_URLS.brno} target="_blank" rel="noopener noreferrer" />}
                        >
                            <ItemMedia variant="icon" className="text-muted-foreground">
                                <Database size={18} strokeWidth={2} />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle className="text-foreground">IDS JMK (Brno)</ItemTitle>
                            </ItemContent>
                            <ItemActions>
                                <Badge variant="outline" className="text-[10px] text-muted-foreground/70 border-border/40 bg-foreground/5 uppercase font-semibold tracking-wider">
                                    {t('settings.dataSource')}
                                </Badge>
                            </ItemActions>
                        </Item>

                        <Item
                            variant="settings"
                            size="none"
                            render={<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" />}
                        >
                            <ItemMedia variant="icon" className="text-muted-foreground">
                                <Scale size={18} strokeWidth={2} />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle className="text-foreground">{t('settings.license')}</ItemTitle>
                            </ItemContent>
                            <ItemActions>
                                <Badge variant="outline" className="text-[10px] text-muted-foreground/70 border-border/40 bg-foreground/5 uppercase font-semibold tracking-wider">
                                    CC BY 4.0
                                </Badge>
                            </ItemActions>
                        </Item>
                    </ItemGroup>
                </Card>
            </div>

            {updatedAt && (
                <div className="text-[10px] text-muted-foreground/30 font-medium text-center pb-2 px-6">
                    {t('settings.lastStopUpdate', { date: formatDateTime(updatedAt, i18n.language) })}
                </div>
            )}
        </div>
    );
};

SettingsFooter.displayName = 'SettingsFooter';
