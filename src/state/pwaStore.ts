import { create } from 'zustand';

export interface PWAState {
    offlineReady: boolean;
    needRefresh: boolean;
}

export interface PWAActions {
    setOfflineReady: (ready: boolean) => void;
    setNeedRefresh: (refresh: boolean) => void;
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
    },
}));
