import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { MapPin, Bus, ArrowRight } from 'lucide-react';
import { STORAGE_KEYS } from '../../config/constants';
import { useGeolocation } from '../../hooks/features/useGeolocation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

/**
 * WelcomeModal
 *
 * Re-architected with semantic layout components.
 */
export const WelcomeModal: React.FC = () => {
    const { t } = useTranslation();
    const { handleLocate } = useGeolocation();
    const [isOpen, setIsOpen] = useState(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search);
        
        // If the user arrives via a deep link to a specific entity, skip the welcome modal
        const path = window.location.pathname;
        const hasDeepLink = params.has('stopId') || params.has('tripId') || params.has('vehicleId') || path.includes('/stop/') || path.includes('/trip/');
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
            <DialogContent aria-describedby={undefined} variant="default" showCloseButton={false} className="h-fit gap-8! p-6!">
                <DialogHeader>
                    <DialogTitle className="text-center flex items-center justify-center gap-2 text-2xl">
                        {t('welcome.title')}
                        <Badge variant="soft" className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider">
                            {t('welcome.beta')}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4 text-center mt-2">
                        <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center p-0 border border-white/10 shadow-2xl overflow-hidden">
                            <img src="/pwa-192x192.png" alt="App Logo" className="w-full h-full object-cover rounded-3xl" />
                        </div>
                        <div>
                            <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px]">
                                {t('welcome.description')}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <Alert variant="subtle">
                            <MapPin size={20} className="text-primary" strokeWidth={1.5} />
                            <AlertTitle className="font-semibold leading-tight">{t('welcome.steps.clickStop.title')}</AlertTitle>
                            <AlertDescription className="text-xs leading-snug">{t('welcome.steps.clickStop.description')}</AlertDescription>
                        </Alert>

                        <Alert variant="subtle">
                            <Bus size={20} className="text-primary" strokeWidth={1.5} />
                            <AlertTitle className="font-semibold leading-tight">{t('welcome.steps.trackVehicles.title')}</AlertTitle>
                            <AlertDescription className="text-xs leading-snug">{t('welcome.steps.trackVehicles.description')}</AlertDescription>
                        </Alert>
                    </div>

                    <Button
                        size="xl"
                        onClick={handleClose}
                        data-testid="welcome-cta"
                        className="w-full transition-all flex items-center justify-center gap-2 group font-bold"
                    >
                        {t('welcome.cta')}
                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"  strokeWidth={1.5} />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

WelcomeModal.displayName = 'WelcomeModal';
