import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Box, Stack, HStack } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';

/**
 * UpdatePopup
 *
 * Re-architected with semantic components.
 */
export const UpdatePopup: React.FC = () => {
    const { t } = useTranslation();
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ', r);
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    return (
        <AnimatePresence>
            {(offlineReady || needRefresh) && (
                <Box className="fixed bottom-24 left-4 right-4 z-[100] md:left-auto md:right-4 md:w-80">
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                    >
                        <HStack className="bg-background/90 backdrop-blur-xl border border-border p-4 rounded-2xl shadow-2xl justify-between gap-4">
                            <HStack className="items-start gap-3">
                                <Box className="mt-0.5 p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                                    <RefreshCw size={18} className={needRefresh ? 'animate-spin' : ''} />
                                </Box>
                                <Stack className="gap-0.5">
                                    <span className="text-foreground text-sm font-semibold">
                                        {needRefresh ? t('update.newVersion') : t('update.pwaPrompt')}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        {needRefresh ? t('update.updateNow') : t('update.addToHome')}
                                    </span>
                                </Stack>
                            </HStack>

                            <HStack className="gap-2">
                                {needRefresh && (
                                    <Button
                                        size="sm"
                                        onClick={() => updateServiceWorker(true)}
                                        className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg"
                                    >
                                        {t('update.updateButton')}
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={close}
                                    className="h-10 w-10 -m-1.5 text-muted-foreground"
                                >
                                    <X size={16} />
                                </Button>
                            </HStack>
                        </HStack>
                    </motion.div>
                </Box>
            )}
        </AnimatePresence>
    );
};
