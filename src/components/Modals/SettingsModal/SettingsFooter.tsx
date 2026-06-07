import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Clock, Database, Code, Scale } from 'lucide-react';
import { version } from '../../../../package.json';
import { usePWAStore } from '../../../state/pwaStore';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useStops } from '../../../hooks/data/useStops';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ItemGroup, Item, ItemMedia, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item';

export const SettingsFooter: React.FC = () => {
    const { t, i18n } = useTranslation();

    // Preferences
    const searchHistory = usePreferencesStore(s => s.searchHistory);
    const { clearHistory } = usePreferencesStore(s => s.actions);

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
            <ItemGroup className="rounded-2xl bg-muted/40 border border-white/5 overflow-hidden gap-0">
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
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-black/20 px-2 py-1 rounded-md">
                            {t('settings.versionBadge', { version })}
                        </span>
                    </ItemActions>
                </Item>
            </ItemGroup>

            <div className="flex flex-col items-center gap-0 w-full">
                <div className="flex justify-center gap-6">
                    <a
                        href="https://golemio.cz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 py-3 text-[10px] text-muted-foreground hover:text-primary transition-colors uppercase font-bold tracking-widest outline-none"
                    >
                        <Database size={14} strokeWidth={1.5} />
                        {t('settings.dataSource')}
                    </a>

                    <a
                        href="https://github.com/joseph5610/departs-app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 py-3 text-[10px] text-muted-foreground hover:text-primary transition-colors uppercase font-bold tracking-widest outline-none"
                    >
                        <Code size={14} strokeWidth={1.5} />
                        {t('settings.viewSource')}
                    </a>
                </div>
                <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 py-2 text-[10px] text-muted-foreground hover:text-primary transition-colors uppercase font-bold tracking-widest outline-none"
                >
                    <Scale size={14} strokeWidth={1.5} />
                    {t('settings.license')}
                </a>
            </div>

            {updatedAt && (
                <div className="text-[10px] text-muted-foreground/30 font-medium text-center pb-2 px-6">
                    {t('settings.lastStopUpdate', { 
                        date: new Date(updatedAt).toLocaleString(i18n.language, {
                            day: 'numeric',
                            month: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }) 
                    })}
                </div>
            )}
        </div>
    );
};

SettingsFooter.displayName = 'SettingsFooter';
