import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Share, Download, X, MoreHorizontal, PlusSquare, ExternalLink, RefreshCw } from 'lucide-react';
import { STORAGE_KEYS } from '../../config/constants';

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
                <DrawerHeader className="pt-6 pb-2">
                    <HStack gap={4} align="center" justify="center">
                        <Box className="w-12 h-12 bg-black rounded-xl flex items-center justify-center p-0 border border-white/10 shadow-lg overflow-hidden shrink-0">
                            <img src="/pwa-192x192.png" alt="App Logo" className="w-full h-full object-cover" />
                        </Box>
                        <Stack gap={0}>
                            <DrawerTitle className="text-lg font-bold leading-tight">{t('pwa.title')}</DrawerTitle>
                            <DrawerDescription className="text-sm">
                                {t('pwa.description')}
                            </DrawerDescription>
                        </Stack>
                    </HStack>
                </DrawerHeader>

                <Box className="px-4 pb-2">
                    <Surface variant="tinted" padding="none" className="relative overflow-hidden rounded-2xl border border-white/5">
                        {platform === 'ios' ? (
                            <IOSMockupAnimation />
                        ) : (
                            <Box className="p-4">
                                <HStack gap={3} align="start">
                                    <Box className="mt-1 text-primary">
                                        <Download size={20} />
                                    </Box>
                                    <Box className="text-sm leading-relaxed">
                                        <Trans
                                            i18nKey={`pwa.instructions.${platform}`}
                                        />
                                    </Box>
                                </HStack>
                            </Box>
                        )}
                    </Surface>
                </Box>

                <DrawerFooter className="pt-2 pb-6 px-4">
                    {platform !== 'ios' && deferredPrompt ? (
                        <Button
                            onClick={handleInstall}
                            size="lg"
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-11"
                        >
                            {t('pwa.button')}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleDismiss}
                            variant="tinted"
                            size="lg"
                            className="w-full font-bold rounded-xl h-11"
                        >
                            {t('pwa.dismiss')}
                        </Button>
                    )}
                </DrawerFooter>

                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X size={18} />
                </button>
            </DrawerContent>
        </Drawer>
    );
};

const IOSMockupAnimation: React.FC = () => {
    const { t } = useTranslation();

    return (
        <Box className="h-[180px] relative bg-neutral-900 flex flex-col items-center justify-end p-4 overflow-hidden">
            {/* Safari Address Bar Mockup */}
            <motion.div
                className="w-full max-w-[280px] h-11 bg-white/10 backdrop-blur-md rounded-full border border-white/10 flex items-center px-4 mb-4 relative z-10 shadow-2xl"
                initial={{ y: 0 }}
            >
                <span className="text-[10px] text-white/40 font-bold mr-3">AA</span>
                <Box className="flex-1 flex items-center justify-center gap-1.5 ml-2">
                    <Box className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                    <span className="text-[12px] text-white/90 font-medium">departs.app</span>
                </Box>
                <Box className="flex items-center gap-3 ml-2">
                    <RefreshCw size={14} className="text-white/60" />
                    <MoreHorizontal size={18} className="text-white/90" />
                </Box>

                {/* Tap Circle Animation on the 3 dots */}
                <motion.div
                    className="absolute right-3.5 w-7 h-7 bg-white/30 rounded-full border border-white/50 pointer-events-none"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                        scale: [0, 1.2, 0],
                        opacity: [0, 1, 0],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        repeatDelay: 2.5,
                        times: [0, 0.2, 0.4]
                    }}
                />
            </motion.div>

            {/* Context Menu Animation */}
            <AnimatePresence>
                <motion.div
                    className="absolute bottom-20 right-6 w-52 bg-neutral-800/98 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-20"
                    initial={{ scale: 0.7, opacity: 0, y: 20, originX: '90%', originY: '100%' }}
                    animate={{
                        scale: [0.7, 1, 1, 0.7],
                        opacity: [0, 1, 1, 0],
                        y: [20, 0, 0, 20]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        times: [0, 0.1, 0.9, 1],
                        ease: [0.16, 1, 0.3, 1]
                    }}
                >
                    <Stack gap={0} className="divide-y divide-white/10">
                        <HStack justify="between" align="center" className="px-4 py-3 text-[12px] text-white/90">
                            <span>Share...</span>
                            <Share size={14} className="text-white/60" />
                        </HStack>
                        <HStack justify="between" align="center" className="px-4 py-3 text-[12px] text-white bg-primary/20">
                            <span className="font-bold text-primary">Add to Home Screen</span>
                            <PlusSquare size={14} className="text-primary" />
                        </HStack>
                        <HStack justify="between" align="center" className="px-4 py-3 text-[12px] text-white/90">
                            <span>Find in Page</span>
                            <ExternalLink size={14} className="text-white/60" />
                        </HStack>
                    </Stack>
                </motion.div>
            </AnimatePresence>

            {/* Instruction Text */}
            <Box className="absolute top-4 left-0 right-0 text-center px-4">
                 <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider">
                    {t('pwa.instructions.ios_guide', 'Click Menu → Add to Home Screen')}
                 </p>
            </Box>
        </Box>
    );
};
