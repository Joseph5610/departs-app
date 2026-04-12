import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
    DrawerHandle
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Box, Stack, Surface, HStack } from '@/components/ui/layout';
import { Share, Download, X } from 'lucide-react';
import { STORAGE_KEYS } from '../../config/constants';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PWAInstallPrompt
 *
 * Provides platform-specific instructions for adding the app to the home screen.
 * Shows once after a delay for non-standalone users.
 */
export const PWAInstallPrompt: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

    // Detect platform and standalone mode
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone ||
            document.referrer.includes('android-app://');

        if (isStandalone) return;

        // Check if seen
        const isSeen = localStorage.getItem(STORAGE_KEYS.PWA_PROMPT_SEEN);
        if (isSeen) return;

        // Platform detection
        const ua = window.navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/.test(ua);

        if (isIOS) setPlatform('ios');
        else if (isAndroid) setPlatform('android');
        else setPlatform('desktop');

        // Handle Android/Chrome install prompt
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Delay logic
        const welcomeSeen = localStorage.getItem(STORAGE_KEYS.WELCOME_SEEN);
        const delay = welcomeSeen ? 10000 : 120000; // 10s if returning, 2m if new

        const timer = setTimeout(() => {
            setIsOpen(true);
        }, delay);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            clearTimeout(timer);
        };
    }, []);

    const handleDismiss = useCallback(() => {
        localStorage.setItem(STORAGE_KEYS.PWA_PROMPT_SEEN, 'true');
        setIsOpen(false);
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                handleDismiss();
            }
            setDeferredPrompt(null);
        }
    };

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && handleDismiss()} handleOnly={true}>
            <DrawerContent className="max-w-md mx-auto">
                <DrawerHandle />
                <DrawerHeader className="pt-8">
                    <Stack align="center" gap={4} className="mb-2">
                        <Box className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center p-0 border border-white/10 shadow-xl overflow-hidden">
                            <img src="/pwa-192x192.png" alt="App Logo" className="w-full h-full object-cover rounded-2xl" />
                        </Box>
                        <DrawerTitle className="text-xl font-bold">{t('pwa.title')}</DrawerTitle>
                        <DrawerDescription className="max-w-[280px] text-center">
                            {t('pwa.description')}
                        </DrawerDescription>
                    </Stack>
                </DrawerHeader>

                <Box className="px-6 pb-4">
                    <Surface variant="tinted" padding="md" className="relative overflow-hidden">
                        <Stack gap={4}>
                            <HStack gap={3} align="start">
                                <Box className="mt-1 text-primary">
                                    {platform === 'ios' ? <Share size={20} /> : <Download size={20} />}
                                </Box>
                                <Box className="text-sm leading-relaxed">
                                    <Trans
                                        i18nKey={`pwa.instructions.${platform}`}
                                        components={{
                                            icon: <Share size={16} className="inline-block mb-1 mx-0.5 text-primary" />
                                        }}
                                    />
                                </Box>
                            </HStack>

                            {platform === 'ios' && (
                                <Box className="relative h-24 bg-black/40 rounded-xl border border-white/5 flex items-center justify-center overflow-hidden">
                                     {/* Simple iOS UI Mockup/Animation */}
                                     <motion.div
                                        className="absolute bottom-2 bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center"
                                        animate={{
                                            scale: [1, 1.2, 1],
                                            backgroundColor: ["rgba(255,255,255,0.1)", "rgba(var(--color-primary-rgb),0.2)", "rgba(255,255,255,0.1)"]
                                        }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                     >
                                        <Share size={16} className="text-primary" />
                                     </motion.div>
                                     <motion.div
                                        className="absolute bottom-12 right-4 bg-primary/20 border border-primary/30 px-3 py-1.5 rounded-lg text-[10px] font-bold text-primary flex items-center gap-1"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, 0] }}
                                        transition={{ duration: 4, repeat: Infinity, times: [0, 0.2, 0.8, 1] }}
                                     >
                                        Add to Home Screen
                                     </motion.div>
                                </Box>
                            )}
                        </Stack>
                    </Surface>
                </Box>

                <DrawerFooter className="pt-2 pb-8 px-6">
                    {platform !== 'ios' && deferredPrompt ? (
                        <Button
                            onClick={handleInstall}
                            size="lg"
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl h-12"
                        >
                            {t('pwa.button')}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleDismiss}
                            variant="tinted"
                            size="lg"
                            className="w-full font-bold rounded-2xl h-12"
                        >
                            {t('pwa.dismiss')}
                        </Button>
                    )}
                </DrawerFooter>

                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X size={20} />
                </button>
            </DrawerContent>
        </Drawer>
    );
};
