import { createContext, useContext } from 'react';

export interface PWAContextValue {
    offlineReady: boolean;
    setOfflineReady: (ready: boolean) => void;
    needRefresh: boolean;
    setNeedRefresh: (refresh: boolean) => void;
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

export const PWAContext = createContext<PWAContextValue | null>(null);

export const usePWA = (): PWAContextValue => {
    const context = useContext(PWAContext);
    if (!context) {
        throw new Error('usePWA must be used within a PWAProvider');
    }
    return context;
};
