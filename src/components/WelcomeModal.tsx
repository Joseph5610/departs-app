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
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar !rounded-[32px] border-white/10 bg-black/95 backdrop-blur-md" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-white tracking-tight text-center">
                        {t('welcome.title')}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-8">
                    <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-24 h-24 bg-black/20 rounded-[2rem] flex items-center justify-center p-4 ring-1 ring-white/10 shadow-2xl backdrop-blur-xl">
                        <img src="/pwa-192x192.png" alt="App Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <p className="text-zinc-400 text-sm leading-relaxed max-w-[280px]">
                            {t('welcome.description')}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="mt-1 text-emerald-400"><Info size={18} /></div>
                        <div>
                            <div className="text-white font-semibold text-sm">{t('welcome.steps.clickStop.title')}</div>
                            <div className="text-zinc-500 text-xs mt-1">{t('welcome.steps.clickStop.description')}</div>
                        </div>
                    </div>

                    <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="mt-1 text-emerald-400"><Info size={18} /></div>
                        <div>
                            <div className="text-white font-semibold text-sm">{t('welcome.steps.trackVehicles.title')}</div>
                            <div className="text-zinc-500 text-xs mt-1">{t('welcome.steps.trackVehicles.description')}</div>
                        </div>
                    </div>
                    </div>

                    <button
                    onClick={handleClose}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 group"
                >
                    {t('welcome.cta')}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
