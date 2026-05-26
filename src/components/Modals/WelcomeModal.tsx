import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Info, ArrowRight } from 'lucide-react';
import { STORAGE_KEYS } from '../../config/constants';
import { useGeolocationStore } from '../../state/geolocationStore';
import { Box, Stack, Surface } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * WelcomeModal
 *
 * Re-architected with semantic layout components.
 */
export const WelcomeModal: React.FC = () => {
    const { t } = useTranslation();
    const { handleLocate } = useGeolocationStore(s => s.actions);
    const [isOpen, setIsOpen] = useState(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search);
        
        // If the user arrives via a deep link to a specific entity, skip the welcome modal
        const hasDeepLink = params.has('stopId') || params.has('tripId') || params.has('vehicleId');
        if (hasDeepLink) {
            localStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, 'true');
            return false;
        }

        if (params.has('skipTutorial')) return false;
        return !localStorage.getItem(STORAGE_KEYS.WELCOME_SEEN);
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        
        if (params.has('skipTutorial')) {
            localStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, 'true');
            handleLocate();

            const url = new URL(window.location.href);
            url.searchParams.delete('skipTutorial');
            window.history.replaceState({}, '', url.toString());
        }
    }, [handleLocate]);

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, 'true');
        setIsOpen(false);
        handleLocate();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent aria-describedby={undefined} variant="tinted" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle className="text-center flex items-center justify-center gap-2">
                        {t('welcome.title')}
                        <Badge variant="secondary" className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border-primary/20">
                            {t('welcome.beta')}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>
                <Stack gap={8}>
                    <Stack align="center" gap={4} className="text-center">
                        <Box className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center p-0 border border-white/10 shadow-2xl overflow-hidden">
                            <img src="/pwa-192x192.png" alt="App Logo" className="w-full h-full object-cover rounded-3xl" />
                        </Box>
                        <Box>
                            <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px]">
                                {t('welcome.description')}
                            </p>
                        </Box>
                    </Stack>

                    <Stack gap={4}>
                        <Surface variant="tinted" padding="md" className="flex flex-row items-start gap-4">
                            <Box className="mt-1 text-primary"><Info size={20}  strokeWidth={1.5} /></Box>
                            <Stack gap={1}>
                                <h3 className="font-semibold text-sm leading-none">{t('welcome.steps.clickStop.title')}</h3>
                                <p className="text-muted-foreground text-xs">{t('welcome.steps.clickStop.description')}</p>
                            </Stack>
                        </Surface>

                        <Surface variant="tinted" padding="md" className="flex flex-row items-start gap-4">
                            <Box className="mt-1 text-primary"><Info size={20}  strokeWidth={1.5} /></Box>
                            <Stack gap={1}>
                                <h3 className="font-semibold text-sm leading-none">{t('welcome.steps.trackVehicles.title')}</h3>
                                <p className="text-muted-foreground text-xs">{t('welcome.steps.trackVehicles.description')}</p>
                            </Stack>
                        </Surface>
                    </Stack>

                    <Button
                        size="lg"
                        onClick={handleClose}
                        data-testid="welcome-cta"
                        className="w-full h-auto py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group"
                    >
                        {t('welcome.cta')}
                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"  strokeWidth={1.5} />
                    </Button>
                </Stack>
            </DialogContent>
        </Dialog>
    );
};

WelcomeModal.displayName = 'WelcomeModal';
