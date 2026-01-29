import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { MapPin, Info, ArrowRight } from 'lucide-react';

export const WelcomeModal: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem('departs_welcome_seen');
        if (!hasSeenWelcome) {
            setIsOpen(true);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem('departs_welcome_seen', 'true');
        setIsOpen(false);
        onGetStarted();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Welcome to departs.app">
            <div className="space-y-8">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 shadow-inner">
                        <MapPin size={40} strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-[280px]">
                            The fastest way to track departures and real-time locations of your transport.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="mt-1 text-emerald-400"><Info size={18} /></div>
                        <div>
                            <div className="text-white font-semibold text-sm">Click on a stop</div>
                            <div className="text-slate-500 text-xs mt-1">See upcoming departures with real-time delay info.</div>
                        </div>
                    </div>

                    <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="mt-1 text-emerald-400"><Info size={18} /></div>
                        <div>
                            <div className="text-white font-semibold text-sm">Track vehicles</div>
                            <div className="text-slate-500 text-xs mt-1">The arrow next to a vehicle shows its current direction.</div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleClose}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 group"
                >
                    Get Started
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </Modal>
    );
};
