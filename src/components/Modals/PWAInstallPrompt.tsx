import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { motion } from 'framer-motion';
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
import { Share, Download, MoreHorizontal, PlusSquare, RefreshCw } from 'lucide-react';
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
        if (isSeen) {
            if (isSeen === 'permanent' || isSeen === 'true') return;

            const lastSeenDate = new Date(isSeen);
            const now = new Date();
            const diffDays = (now.getTime() - lastSeenDate.getTime()) / (1000 * 3600 * 24);

            if (diffDays < 7) return;
        }

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

    const handleDismiss = useCallback((permanent: boolean = false) => {
        localStorage.setItem(
            STORAGE_KEYS.PWA_PROMPT_SEEN,
            permanent ? 'permanent' : new Date().toISOString()
        );
        setIsOpen(false);
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                handleDismiss(true);
            }
            setDeferredPrompt(null);
        }
    };

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && handleDismiss(false)}>
            <DrawerContent className="max-w-md mx-auto focus:outline-none">
                <DrawerHandle />
                <DrawerHeader className="pt-6 pb-4">
                    <Stack gap={4} align="center">
                        <Box className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center p-0 border border-white/10 shadow-2xl overflow-hidden shrink-0">
                            <img src="/pwa-192x192.png" alt="App Logo" className="w-full h-full object-cover" />
                        </Box>
                        <Stack gap={1} align="center" className="text-center">
                            <DrawerTitle className="text-xl font-bold tracking-tight">{t('pwa.title')}</DrawerTitle>
                            <DrawerDescription className="text-sm text-muted-foreground px-4">
                                {t('pwa.description')}
                            </DrawerDescription>
                        </Stack>
                    </Stack>
                </DrawerHeader>

                <Box className="px-4 pb-2">
                    <Surface variant="tinted" padding="none" className="relative overflow-hidden rounded-2xl border border-white/10 shadow-inner">
                        {platform === 'ios' ? (
                            <IOSMockupAnimation />
                        ) : (
                            <Box className="p-5">
                                <HStack gap={3} align="center" justify="center" className="text-center">
                                    <Box className="text-primary shrink-0">
                                        <Download size={20} />
                                    </Box>
                                    <Box className="text-sm font-medium leading-relaxed">
                                        <Trans
                                            i18nKey={`pwa.instructions.${platform}`}
                                        />
                                    </Box>
                                </HStack>
                            </Box>
                        )}
                    </Surface>
                </Box>

                <DrawerFooter className="pt-4 pb-12 px-8">
                    <Stack gap={4}>
                        {platform !== 'ios' && deferredPrompt && (
                            <Button
                                onClick={handleInstall}
                                size="lg"
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl h-12 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                            >
                                {t('pwa.button')}
                            </Button>
                        )}

                        <HStack gap={4} className="w-full" justify="center">
                            <Button
                                variant="ghost"
                                onClick={() => handleDismiss(false)}
                                className="text-muted-foreground hover:text-foreground h-10 px-4 rounded-xl font-medium transition-colors"
                            >
                                {t('pwa.snooze')}
                            </Button>
                            <Box className="w-px h-4 bg-white/10" />
                            <Button
                                variant="ghost"
                                onClick={() => handleDismiss(true)}
                                className="text-muted-foreground/40 hover:text-muted-foreground h-10 px-4 rounded-xl text-xs font-normal transition-colors"
                            >
                                {t('pwa.never')}
                            </Button>
                        </HStack>
                    </Stack>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
};

const IOSMockupAnimation: React.FC = () => {
    const { t } = useTranslation();
    const duration = 10;

    return (
        <Box className="h-[220px] relative bg-[#0a0a0a] flex flex-col items-center justify-end pb-6 pt-12 px-4 overflow-hidden">
            {/* Instruction Text - Background layer */}
            <Box className="absolute top-4 left-0 right-0 text-center px-4 z-0">
                 <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                    {t('pwa.instructions.ios_guide', 'Click Menu → Share → Add to Home Screen')}
                 </p>
            </Box>

            {/* Safari Address Bar Mockup */}
            <motion.div
                className="w-full max-w-[280px] h-12 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center px-4 relative z-10 shadow-2xl"
                animate={{
                    scale: [1, 0.98, 1, 1, 1, 1],
                }}
                transition={{
                    duration,
                    repeat: Infinity,
                    times: [0, 0.05, 0.1, 0.4, 0.9, 1]
                }}
            >
                <span className="text-[10px] text-white/40 font-bold mr-3">AA</span>
                <Box className="flex-1 flex items-center justify-center gap-1.5 ml-2">
                    <Box className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                    <span className="text-[13px] text-white/90 font-medium">departs.app</span>
                </Box>
                <Box className="flex items-center gap-3 ml-2">
                    <RefreshCw size={14} className="text-white/60" />
                    <MoreHorizontal size={18} className="text-white/90" />
                </Box>

                {/* Tap Circle Animation on the 3 dots */}
                <motion.div
                    className="absolute right-3 w-8 h-8 bg-white/20 rounded-full border border-white/40 pointer-events-none"
                    animate={{
                        scale: [0, 1.2, 0, 0, 0, 0, 0],
                        opacity: [0, 1, 0, 0, 0, 0, 0],
                    }}
                    transition={{
                        duration,
                        repeat: Infinity,
                        times: [0, 0.05, 0.1, 0.15, 0.4, 0.9, 1]
                    }}
                />
            </motion.div>

            {/* Menu 1 (Safari Menu) */}
            <motion.div
                className="absolute bottom-20 right-6 w-52 bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-20"
                initial={{ scale: 0.8, opacity: 0, y: 20, originX: '90%', originY: '100%' }}
                animate={{
                    scale: [0.8, 1, 1, 1, 0.8, 0.8],
                    opacity: [0, 1, 1, 1, 0, 0],
                    y: [20, 0, 0, 0, 20, 20]
                }}
                transition={{
                    duration,
                    repeat: Infinity,
                    times: [0.08, 0.12, 0.4, 0.44, 0.48, 1],
                    ease: [0.16, 1, 0.3, 1]
                }}
            >
                <Stack gap={0} className="divide-y divide-white/5">
                    <HStack justify="between" align="center" className="px-4 py-3.5 text-[13px] text-white/40">
                        <span>Show Bookmarks</span>
                    </HStack>
                    <motion.div
                        animate={{
                            backgroundColor: ['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0)']
                        }}
                        transition={{
                            duration,
                            repeat: Infinity,
                            times: [0, 0.3, 0.35, 0.43, 0.5]
                        }}
                    >
                        <HStack justify="between" align="center" className="px-4 py-3.5 text-[13px] text-white relative">
                            <span className="font-semibold text-primary">Share...</span>
                            <Share size={16} className="text-primary" />

                            {/* Tap Circle Animation on Share */}
                            <motion.div
                                className="absolute right-2 w-9 h-9 bg-white/20 rounded-full border border-white/40 pointer-events-none"
                                animate={{
                                    scale: [0, 0, 1.2, 0, 0],
                                    opacity: [0, 0, 1, 0, 0],
                                }}
                                transition={{
                                    duration,
                                    repeat: Infinity,
                                    times: [0, 0.35, 0.38, 0.42, 1]
                                }}
                            />
                        </HStack>
                    </motion.div>
                </Stack>
            </motion.div>

            {/* Menu 2 (Share Sheet Mockup) */}
            <motion.div
                className="absolute bottom-20 right-6 w-64 bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-20"
                initial={{ scale: 0.8, opacity: 0, y: 20, originX: '90%', originY: '100%' }}
                animate={{
                    scale: [0.8, 0.8, 1, 1, 1, 0.8],
                    opacity: [0, 0, 1, 1, 1, 0],
                    y: [20, 20, 0, 0, 0, 20]
                }}
                transition={{
                    duration,
                    repeat: Infinity,
                    times: [0, 0.45, 0.49, 0.85, 0.89, 1],
                    ease: [0.16, 1, 0.3, 1]
                }}
            >
                <Stack gap={0} className="divide-y divide-white/5">
                    <HStack justify="between" align="center" className="px-4 py-3.5 text-[12px] text-white/30">
                        <span>Copy Link</span>
                    </HStack>
                    <motion.div
                        animate={{
                            backgroundColor: ['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0)']
                        }}
                        transition={{
                            duration,
                            repeat: Infinity,
                            times: [0, 0.75, 0.78, 0.85, 0.9]
                        }}
                    >
                        <HStack justify="between" align="center" className="px-4 py-3.5 text-[13px] text-white relative">
                            <span className="font-semibold text-primary">Add to Home Screen</span>
                            <PlusSquare size={16} className="text-primary" />

                            {/* Tap Circle Animation on Add to Home Screen */}
                            <motion.div
                                className="absolute right-2 w-9 h-9 bg-white/20 rounded-full border border-white/40 pointer-events-none"
                                animate={{
                                    scale: [0, 0, 1.2, 0, 0],
                                    opacity: [0, 0, 1, 0, 0],
                                }}
                                transition={{
                                    duration,
                                    repeat: Infinity,
                                    times: [0, 0.78, 0.81, 0.84, 1]
                                }}
                            />
                        </HStack>
                    </motion.div>
                    <HStack justify="between" align="center" className="px-4 py-3.5 text-[12px] text-white/30">
                        <span>Add to Bookmarks</span>
                    </HStack>
                </Stack>
            </motion.div>
        </Box>
    );
};
