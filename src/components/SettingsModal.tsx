import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Eye, EyeOff, Github, RefreshCw, Info } from 'lucide-react';
import { version } from '../../package.json';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '../hooks/useToast';
import { useMap } from '../hooks/useMap';



export const SettingsModal: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { state, actions } = useMap();

    const { isSettingsOpen: isOpen, showVehicles } = state;
    const { setIsSettingsOpen, setShowVehicles } = actions;

    const onClose = React.useCallback(() => {
        setIsSettingsOpen(false);
    }, [setIsSettingsOpen]);
    const { showToast } = useToast();
    const [isChecking, setIsChecking] = useState(false);
    const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        needRefresh: [needRefresh],
    } = useRegisterSW();

    // Handle update detection during manual check
    useEffect(() => {
        if (isChecking && needRefresh) {
            showToast(t('settings.updates.available'), 'success');
            setIsChecking(false);
            if (checkTimerRef.current) {
                clearTimeout(checkTimerRef.current);
                checkTimerRef.current = null;
            }
        }
    }, [needRefresh, isChecking, showToast, t]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (checkTimerRef.current) {
                clearTimeout(checkTimerRef.current);
            }
        };
    }, []);

    const handleCheckUpdate = async () => {
        if (isChecking) return;

        setIsChecking(true);
        showToast(t('settings.updates.checking'), 'info');

        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();

                    // Fallback timer if no update is found or already up to date
                    checkTimerRef.current = setTimeout(() => {
                        setIsChecking(false);
                        checkTimerRef.current = null;
                        if (!needRefresh) {
                            showToast(t('settings.updates.upToDate'), 'success');
                        }
                    }, 2000);
                    return;
                }
            }
            throw new Error('SW not found');
        } catch (error) {
            console.error('Update check failed', error);
            setIsChecking(false);
            showToast(t('settings.updates.upToDate'), 'success');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('settings.title')}>
            <div className="space-y-8 py-2">
                {/* Live Vehicles Toggle */}
                <section className="space-y-3">
                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest px-1">
                        {t('settings.sections.display')}
                    </div>
                    <button
                        onClick={() => setShowVehicles(!showVehicles)}
                        className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-white/5 hover:bg-white/10 active:bg-white/20 rounded-2xl border border-white/10 transition-all text-left group"
                    >
                        <div className="flex items-center gap-0 sm:gap-4 min-w-0 flex-1">
                            <div className={`p-3 rounded-xl transition-colors shrink-0 ${showVehicles ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'} hidden sm:flex`}>
                                {showVehicles ? <Eye size={22} /> : <EyeOff size={22} />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-white font-semibold leading-snug">
                                    {t('settings.liveVehicles.title')}
                                </div>
                                <div className="text-zinc-500 text-xs mt-1 leading-tight">
                                    {t('settings.liveVehicles.description')}
                                </div>
                            </div>
                        </div>

                        <div
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ml-3 sm:ml-4 ${showVehicles ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showVehicles ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </div>
                    </button>
                </section>

                {/* Language Selection */}
                <section className="space-y-3">
                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest px-1">
                        {t('settings.sections.language')}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {(['en', 'cs'] as const).map((lang) => (
                            <button
                                key={lang}
                                onClick={() => i18n.changeLanguage(lang)}
                                className={`py-3 px-4 rounded-2xl border transition-all text-sm font-semibold ${(i18n.resolvedLanguage || i18n.language).startsWith(lang)
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-inner shadow-emerald-500/5'
                                    : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10'
                                    }`}
                            >
                                {t(`settings.language.${lang}`)}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Tip Box */}
                <div className="p-3.5 sm:p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex gap-2.5 sm:gap-3">
                    <div className="shrink-0 text-amber-500/50 mt-0.5">
                        <Info size={16} />
                    </div>
                    <div className="text-zinc-400 text-xs leading-relaxed">
                        <span className="text-amber-200/80 font-bold">{t('settings.tip.prefix')}</span> {t('settings.tip.text')}
                    </div>
                </div>

                {/* Footer Actions & Info */}
                <div className="pt-4 space-y-6 border-t border-white/5">
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleCheckUpdate}
                            disabled={isChecking}
                            className="flex items-center justify-between p-3.5 sm:p-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] rounded-2xl border border-white/5 transition-all text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-zinc-500/10 text-zinc-400">
                                    <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
                                </div>
                                <span className="text-zinc-300 text-sm font-medium">{t('settings.updates.check')}</span>
                            </div>
                            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md">
                                {t('settings.versionBadge', { version })}
                            </span>
                        </button>

                        <a
                            href="https://github.com/joseph5610/departs-app"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 py-3 text-[10px] text-zinc-500 hover:text-emerald-500 transition-colors uppercase font-bold tracking-widest"
                        >
                            <Github size={14} />
                            {t('settings.viewSource')}
                        </a>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
