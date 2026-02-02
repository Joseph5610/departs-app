import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Eye, EyeOff } from 'lucide-react';
import { version } from '../../package.json';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    showVehicles: boolean;
    setShowVehicles: (val: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    showVehicles,
    setShowVehicles
}) => {
    const { t, i18n } = useTranslation();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('settings.title')}>
            <div className="space-y-6">
                <button
                    onClick={() => setShowVehicles(!showVehicles)}
                    className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 active:bg-white/20 rounded-2xl border border-white/10 transition-all text-left group"
                >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`p-3 rounded-xl transition-colors shrink-0 hidden md:block ${showVehicles ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'}`}>
                            {showVehicles ? <Eye size={22} /> : <EyeOff size={22} />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-white font-semibold truncate">{t('settings.liveVehicles.title')}</div>
                            <div className="text-zinc-500 text-xs mt-0.5 leading-tight">{t('settings.liveVehicles.description')}</div>
                        </div>
                    </div>

                    <div
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ml-4 ${showVehicles ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showVehicles ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                    </div>
                </button>

                <div className="space-y-3">
                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest px-1">{t('settings.language.title')}</div>
                    <div className="grid grid-cols-2 gap-3">
                        {(['en', 'cs'] as const).map((lang) => (
                            <button
                                key={lang}
                                onClick={() => i18n.changeLanguage(lang)}
                                className={`py-3 px-4 rounded-2xl border transition-all text-sm font-semibold ${
                                    (i18n.resolvedLanguage || i18n.language).startsWith(lang)
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-inner shadow-emerald-500/5'
                                        : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10'
                                }`}
                            >
                                {t(`settings.language.${lang}`)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                    <div className="text-amber-200/80 text-xs leading-relaxed">
                        <strong>{t('settings.tip.prefix')}</strong> {t('settings.tip.text')}
                    </div>
                </div>

                <div className="pt-4 flex justify-center">
                    <span className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase">
                        {t('settings.version', { version })}
                    </span>
                </div>
            </div>
        </Modal>
    );
};
