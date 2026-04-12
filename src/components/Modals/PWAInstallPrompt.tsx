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
import { isStandalone } from '@/utils/pwaUtils';

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

        if (isStandalone()) return;

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
        <Drawer open={isOpen} onOpenChange={(open) => !open && handleDismiss(false)} handleOnly={false}>
            <DrawerContent className="max-w-md mx-auto focus:outline-none overflow-hidden">
                <DrawerHandle />
                <DrawerHeader className="pt-5 pb-3">
                    <Stack gap={3} align="center">
                        <Box className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center p-0 border border-white/10 shadow-2xl overflow-hidden shrink-0">
                            <img src="/pwa-192x192.png" alt="App Logo" className="w-full h-full object-cover" />
                        </Box>
                        <Stack gap={1} align="center" className="text-center px-4">
                            <DrawerTitle className="text-lg font-bold tracking-tight">{t('pwa.title')}</DrawerTitle>
                            <DrawerDescription className="text-[13px] text-muted-foreground leading-snug">
                                {t('pwa.description')}
                            </DrawerDescription>
                        </Stack>
                    </Stack>
                </DrawerHeader>

                <Box className="px-4 pb-2">
                    <Surface variant="tinted" padding="none" className="relative overflow-hidden rounded-2xl border border-white/5 shadow-inner bg-black/40">
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

                <DrawerFooter className="pt-2 pb-8 px-8">
                    <Stack gap={3}>
                        {platform !== 'ios' && deferredPrompt && (
                            <Button
                                onClick={handleInstall}
                                size="lg"
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl h-11 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                            >
                                {t('pwa.button')}
                            </Button>
                        )}

                        <HStack gap={4} className="w-full" justify="center" align="center">
                            <Button
                                variant="ghost"
                                onClick={() => handleDismiss(false)}
                                className="text-muted-foreground hover:text-foreground h-9 px-4 rounded-xl text-sm font-medium transition-colors"
                            >
                                {t('pwa.snooze')}
                            </Button>
                            <Box className="w-px h-3 bg-white/10" />
                            <Button
                                variant="ghost"
                                onClick={() => handleDismiss(true)}
                                className="text-muted-foreground/30 hover:text-muted-foreground h-9 px-4 rounded-xl text-[11px] font-normal transition-colors"
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
    const duration = 12;

    // Animation states:
    // 0: Idle
    // 1: Click Menu (0-1s tap, 1-1.5s menu appear)
    // 2: Menu Visible, Select Share (1.5-4s wait, 4-4.5s tap, 4.5-5s menu disappear, 5-5.5s sheet appear)
    // 3: Sheet Visible, Select Add (5.5-8s wait, 8-8.5s tap, 8.5-9s exit)
    // 4: Exit sequence (9-12s pause before repeat)

    return (
        <Box className="h-[200px] relative bg-[#050505] flex flex-col items-center justify-end pb-5 pt-10 px-4 overflow-hidden">
            {/* Instruction Text */}
            <Box className="absolute top-3 left-0 right-0 text-center px-4 z-0">
                 <p className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">
                    {t('pwa.instructions.ios_guide', 'Click Menu → Share → Add to Home Screen')}
                 </p>
            </Box>

            {/* Safari Address Bar Mockup */}
            <motion.div
                className="w-full max-w-[260px] h-11 bg-white/[0.08] backdrop-blur-xl rounded-2xl border border-white/10 flex items-center px-4 relative z-10 shadow-2xl"
                animate={{
                    scale: [1, 0.96, 1, 1, 1, 1, 1],
                }}
                transition={{
                    duration,
                    repeat: Infinity,
                    times: [0, 0.04, 0.08, 0.4, 0.8, 0.9, 1]
                }}
            >
                <span className="text-[9px] text-white/30 font-black mr-2">AA</span>
                <Box className="flex-1 flex items-center justify-center gap-1.5">
                    <Box className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                    <span className="text-[12px] text-white/80 font-semibold tracking-tight">departs.app</span>
                </Box>
                <Box className="flex items-center gap-2.5 ml-2">
                    <RefreshCw size={12} className="text-white/40" />
                    <MoreHorizontal size={16} className="text-white/80" />
                </Box>

                {/* Tap Circle Animation on the 3 dots */}
                <motion.div
                    className="absolute right-2.5 w-8 h-8 bg-white/20 rounded-full border border-white/40 pointer-events-none"
                    animate={{
                        scale: [0, 1.2, 0, 0, 0, 0, 0, 0],
                        opacity: [0, 1, 0, 0, 0, 0, 0, 0],
                    }}
                    transition={{
                        duration,
                        repeat: Infinity,
                        times: [0, 0.04, 0.08, 0.1, 0.4, 0.8, 0.9, 1]
                    }}
                />
            </motion.div>

            {/* Menus Container with AnimatePresence logic built into manual motion.divs */}

            {/* Menu 1 (Safari Menu) */}
            <motion.div
                className="absolute bottom-18 right-6 w-48 bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden z-20"
                initial={{ scale: 0.9, opacity: 0, y: 10, originX: '90%', originY: '100%' }}
                animate={{
                    scale: [0.9, 1, 1, 1, 0.9, 0.9],
                    opacity: [0, 1, 1, 1, 0, 0],
                    y: [10, 0, 0, 0, 10, 10],
                    pointerEvents: ['none', 'auto', 'auto', 'none', 'none', 'none']
                }}
                transition={{
                    duration,
                    repeat: Infinity,
                    times: [0.06, 0.1, 0.42, 0.46, 0.5, 1],
                    ease: "anticipate"
                }}
            >
                <Stack gap={0} className="divide-y divide-white/5">
                    <HStack justify="between" align="center" className="px-4 py-3 text-[12px] text-white/40">
                        <span>Show Bookmarks</span>
                    </HStack>
                    <motion.div
                        className="relative"
                        animate={{
                            backgroundColor: ['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0)']
                        }}
                        transition={{
                            duration,
                            repeat: Infinity,
                            times: [0, 0.35, 0.38, 0.45, 0.5]
                        }}
                    >
                        <HStack justify="between" align="center" className="px-4 py-3 text-[12px] text-white">
                            <span className="font-bold text-primary">Share...</span>
                            <Share size={15} className="text-primary" />

                            {/* Tap Circle Animation on Share */}
                            <motion.div
                                className="absolute right-2 w-8 h-8 bg-white/30 rounded-full border border-white/50 pointer-events-none"
                                animate={{
                                    scale: [0, 0, 1.2, 0, 0],
                                    opacity: [0, 0, 1, 0, 0],
                                }}
                                transition={{
                                    duration,
                                    repeat: Infinity,
                                    times: [0, 0.37, 0.4, 0.44, 1]
                                }}
                            />
                        </HStack>
                    </motion.div>
                </Stack>
            </motion.div>

            {/* Menu 2 (Share Sheet Mockup) */}
            <motion.div
                className="absolute bottom-18 right-6 w-60 bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden z-20"
                initial={{ scale: 0.9, opacity: 0, y: 10, originX: '90%', originY: '100%' }}
                animate={{
                    scale: [0.9, 0.9, 1, 1, 1, 0.9],
                    opacity: [0, 0, 1, 1, 1, 0],
                    y: [10, 10, 0, 0, 0, 10],
                    pointerEvents: ['none', 'none', 'auto', 'auto', 'none', 'none']
                }}
                transition={{
                    duration,
                    repeat: Infinity,
                    times: [0, 0.48, 0.52, 0.82, 0.86, 0.9],
                    ease: "anticipate"
                }}
            >
                <Stack gap={0} className="divide-y divide-white/5">
                    <HStack justify="between" align="center" className="px-4 py-3 text-[11px] text-white/30">
                        <span>Copy Link</span>
                    </HStack>
                    <motion.div
                        className="relative"
                        animate={{
                            backgroundColor: ['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0)']
                        }}
                        transition={{
                            duration,
                            repeat: Infinity,
                            times: [0, 0.72, 0.75, 0.85, 0.9]
                        }}
                    >
                        <HStack justify="between" align="center" className="px-4 py-3 text-[12px] text-white">
                            <span className="font-bold text-primary">Add to Home Screen</span>
                            <PlusSquare size={15} className="text-primary" />

                            {/* Tap Circle Animation on Add to Home Screen */}
                            <motion.div
                                className="absolute right-2 w-8 h-8 bg-white/30 rounded-full border border-white/50 pointer-events-none"
                                animate={{
                                    scale: [0, 0, 1.2, 0, 0],
                                    opacity: [0, 0, 1, 0, 0],
                                }}
                                transition={{
                                    duration,
                                    repeat: Infinity,
                                    times: [0, 0.75, 0.78, 0.82, 1]
                                }}
                            />
                        </HStack>
                    </motion.div>
                    <HStack justify="between" align="center" className="px-4 py-3 text-[11px] text-white/30">
                        <span>Add to Bookmarks</span>
                    </HStack>
                </Stack>
            </motion.div>
        </Box>
    );
};
