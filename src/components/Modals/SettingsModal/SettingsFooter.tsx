import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Clock, Database, Github } from 'lucide-react';
import { version } from '../../../../package.json';
import { usePWA } from '../../../contexts/PWAContext';
import { toast } from 'sonner';
import { Box, Stack, HStack } from '@/components/ui/layout';

interface SettingsFooterProps {
    searchHistory: unknown[];
    clearHistory: () => void;
}

/**
 * SettingsFooter
 *
 * Renders the bottom section of settings: clear history, update check, and external links.
 */
export const SettingsFooter: React.FC<SettingsFooterProps> = ({ searchHistory, clearHistory }) => {
    const { t } = useTranslation();
    const [isChecking, setIsChecking] = useState(false);
    const { needRefresh } = usePWA();

    // Reset checking state if update is found
    React.useEffect(() => {
        if (needRefresh && isChecking) {
            setIsChecking(false);
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
        <Stack gap={6}>
            <Stack gap={3}>
                {searchHistory.length > 0 && (
                    <button
                        onClick={() => {
                            clearHistory();
                            toast.success(t('settings.clearHistory.success'));
                        }}
                        className="flex items-center justify-between p-3.5 sm:p-4 bg-muted/40 hover:bg-white/10 active:bg-white/15 active:scale-[0.98] rounded-2xl border transition-all text-left focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <HStack gap={3}>
                            <Box className="p-2 rounded-lg bg-destructive/20 text-destructive">
                                <Clock size={18} />
                            </Box>
                            <span className="text-foreground text-sm font-bold">{t('settings.clearHistory.button')}</span>
                        </HStack>
                    </button>
                )}

                <button
                    onClick={handleCheckUpdate}
                    disabled={isChecking}
                    className="flex items-center justify-between p-3.5 sm:p-4 bg-muted/40 hover:bg-white/10 active:bg-white/15 active:scale-[0.98] rounded-2xl border transition-all text-left outline-none"
                >
                    <HStack gap={3}>
                        <Box className="p-2 rounded-lg bg-white/10 text-foreground">
                            <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
                        </Box>
                        <span className="text-foreground text-sm font-bold">
                            {isChecking ? t('settings.updates.checking') : t('settings.updates.check')}
                        </span>
                    </HStack>
                    <span className="text-[10px] text-foreground/70 font-bold uppercase tracking-widest bg-white/10 px-2 py-1 rounded-md">
                        {t('settings.versionBadge', { version })}
                    </span>
                </button>

                <HStack justify="center" gap={6}>
                    <a
                        href="https://golemio.cz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 py-3 text-[10px] text-muted-foreground hover:text-primary transition-colors uppercase font-bold tracking-widest outline-none"
                    >
                        <Database size={14} />
                        {t('settings.dataSource')}
                    </a>

                    <a
                        href="https://github.com/joseph5610/departs-app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 py-3 text-[10px] text-muted-foreground hover:text-primary transition-colors uppercase font-bold tracking-widest outline-none"
                    >
                        <Github size={14} />
                        {t('settings.viewSource')}
                    </a>
                </HStack>
            </Stack>
        </Stack>
    );
};

SettingsFooter.displayName = 'SettingsFooter';
