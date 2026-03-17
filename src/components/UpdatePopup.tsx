import { useEffect } from 'react';
import { usePWA } from '../contexts/PWAContext';
import { RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Box, Stack, HStack } from '@/components/ui/layout';

/**
 * UpdatePopup
 *
 * Now uses Sonner for a native Shadcn notification experience.
 * This component handles the logic and triggers toasts.
 */
export const UpdatePopup: React.FC = () => {
    const { t } = useTranslation();
    const {
        offlineReady,
        setOfflineReady,
        needRefresh,
        setNeedRefresh,
        updateServiceWorker,
    } = usePWA();

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };


    // Handle "New Version Available"
    useEffect(() => {
        if (needRefresh) {
            toast.custom((id) => (
                <Box className="w-full bg-background/80 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-4 pointer-events-auto">
                    <HStack justify="between" gap={4}>
                        <HStack align="start" gap={3}>
                            <Box className="mt-0.5 p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                                <RefreshCw size={18} className="animate-spin" />
                            </Box>
                            <Stack gap={1}>
                                <span className="text-foreground text-sm font-semibold text-balance">
                                    {t('update.newVersion')}
                                </span>
                                <span className="text-muted-foreground text-xs leading-tight">
                                    {t('update.updateNow')}
                                </span>
                            </Stack>
                        </HStack>

                        <HStack gap={2}>
                            <Button
                                size="sm"
                                onClick={() => {
                                    updateServiceWorker(true);
                                    setNeedRefresh(false);
                                    toast.dismiss(id);
                                }}
                                className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg whitespace-nowrap"
                            >
                                {t('update.updateButton')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    close();
                                    toast.dismiss(id);
                                }}
                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground shrink-0"
                            >
                                <X size={18} />
                            </Button>
                        </HStack>
                    </HStack>
                </Box>
            ), {
                duration: Infinity,
                id: 'sw-update',
            });
        }
    }, [needRefresh, t, updateServiceWorker]);

    // Handle "Offline Ready"
    useEffect(() => {
        if (offlineReady) {
            toast.success(t('update.pwaPrompt'), {
                description: t('update.addToHome'),
                onAutoClose: () => setOfflineReady(false),
                onDismiss: () => setOfflineReady(false),
            });
        }
    }, [offlineReady, t]);

    return null; // Logic-only component
};
