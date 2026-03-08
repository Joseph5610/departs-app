import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Info, ArrowRight } from 'lucide-react';
import { STORAGE_KEYS } from '../config/constants';
import { useMap } from '../hooks/useMap';

export const WelcomeModal: React.FC = () => {
    const { t } = useTranslation();
    const { actions } = useMap();
    const [isOpen, setIsOpen] = useState(() => {
        if (typeof window === 'undefined') return false;
        return !localStorage.getItem(STORAGE_KEYS.WELCOME_SEEN);
    });

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, 'true');
        setIsOpen(false);
        actions.handleLocate();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle className="text-center">
                        {t('welcome.title')}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-8">
                    <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-24 h-24 bg-muted/20 rounded-[2rem] flex items-center justify-center p-4 border border-border shadow-2xl">
                        <img src="/pwa-192x192.png" alt="App Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px]">
                            {t('welcome.description')}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-4 p-4 bg-muted/30 rounded-2xl border border-border">
                        <div className="mt-1 text-primary"><Info size={18} /></div>
                        <div>
                            <div className="font-semibold text-sm">{t('welcome.steps.clickStop.title')}</div>
                            <div className="text-muted-foreground text-xs mt-1">{t('welcome.steps.clickStop.description')}</div>
                        </div>
                    </div>

                    <div className="flex gap-4 p-4 bg-muted/30 rounded-2xl border border-border">
                        <div className="mt-1 text-primary"><Info size={18} /></div>
                        <div>
                            <div className="font-semibold text-sm">{t('welcome.steps.trackVehicles.title')}</div>
                            <div className="text-muted-foreground text-xs mt-1">{t('welcome.steps.trackVehicles.description')}</div>
                        </div>
                    </div>
                    </div>

                    <button
                    onClick={handleClose}
                    className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group"
                >
                    {t('welcome.cta')}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
