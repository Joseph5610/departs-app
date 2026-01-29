import React from 'react';
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
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settings">
            <div className="space-y-6">
                <button
                    onClick={() => setShowVehicles(!showVehicles)}
                    className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 active:bg-white/20 rounded-2xl border border-white/10 transition-all text-left group"
                >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`p-3 rounded-xl transition-colors shrink-0 ${showVehicles ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                            {showVehicles ? <Eye size={22} /> : <EyeOff size={22} />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-white font-semibold truncate">Live vehicle locations</div>
                            <div className="text-slate-500 text-xs mt-0.5 leading-tight">Show buses, trams, and metro</div>
                        </div>
                    </div>

                    <div
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ml-4 ${showVehicles ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showVehicles ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                    </div>
                </button>

                <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                    <div className="text-amber-200/80 text-xs leading-relaxed">
                        <strong>Tip:</strong> Hiding vehicles can speed up map loading in areas with poor connection.
                    </div>
                </div>

                <div className="pt-4 flex justify-center">
                    <span className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">
                        Version {version}
                    </span>
                </div>
            </div>
        </Modal>
    );
};
