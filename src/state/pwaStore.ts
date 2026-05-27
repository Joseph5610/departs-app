import { create } from 'zustand';

export interface PWAState {
    offlineReady: boolean;
    needRefresh: boolean;
}

export interface PWAActions {
    setOfflineReady: (ready: boolean) => void;
    setNeedRefresh: (refresh: boolean) => void;
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

export interface PWAStore extends PWAState {
    actions: PWAActions;
}

export const usePWAStore = create<PWAStore>((set) => ({
    // State
    offlineReady: false,
    needRefresh: false,

    // Actions
    actions: {
        setOfflineReady: (offlineReady) => set({ offlineReady }),
        setNeedRefresh: (needRefresh) => set({ needRefresh }),
        // This will be populated by the usePWALifecycle hook
        updateServiceWorker: async () => { console.warn('updateServiceWorker not initialized'); },
    },
}));
