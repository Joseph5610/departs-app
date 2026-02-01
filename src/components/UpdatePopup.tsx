import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const UpdatePopup: React.FC = () => {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ', r);
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    return (
        <AnimatePresence>
            {(offlineReady || needRefresh) && (
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 50, opacity: 0 }}
                    className="fixed bottom-24 left-4 right-4 z-[100] md:left-auto md:right-4 md:w-80"
                >
                    <div className="bg-black/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                                <RefreshCw size={18} className={needRefresh ? 'animate-spin' : ''} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-white text-sm font-semibold">
                                    {needRefresh ? 'New version available!' : 'Get the app experience'}
                                </span>
                                <span className="text-zinc-400 text-xs mt-0.5">
                                    {needRefresh ? 'Update now to get latest features.' : 'Add it to your home screen for quick access.'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {needRefresh && (
                                <button
                                    onClick={() => updateServiceWorker(true)}
                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-lg transition-all"
                                >
                                    Update
                                </button>
                            )}
                            <button
                                onClick={close}
                                className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
