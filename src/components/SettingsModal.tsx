import React from 'react';
import { Modal } from './Modal';
import { Eye, EyeOff } from 'lucide-react';

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
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                            {showVehicles ? <Eye size={22} /> : <EyeOff size={22} />}
                        </div>
                        <div>
                            <div className="text-white font-semibold">Live vehicle locations</div>
                            <div className="text-slate-500 text-xs mt-0.5">Show buses, trams, and metro on the map</div>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowVehicles(!showVehicles)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showVehicles ? 'bg-emerald-500' : 'bg-slate-700'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showVehicles ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                    <div className="text-amber-200/80 text-xs leading-relaxed">
                        <strong>Tip:</strong> Hiding vehicles can speed up map loading in areas with poor connection.
                    </div>
                </div>
            </div>
        </Modal>
    );
};
