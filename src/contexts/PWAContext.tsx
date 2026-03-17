import React, { createContext, useContext, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface PWAContextValue {
    offlineReady: boolean;
    setOfflineReady: (ready: boolean) => void;
    needRefresh: boolean;
    setNeedRefresh: (refresh: boolean) => void;
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

const PWAContext = createContext<PWAContextValue | null>(null);

export const PWAProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    return (
        <PWAContext.Provider
            value={{
                offlineReady,
                setOfflineReady,
                needRefresh,
                setNeedRefresh,
                updateServiceWorker,
            }}
        >
            {children}
        </PWAContext.Provider>
    );
};

export const usePWA = (): PWAContextValue => {
    const context = useContext(PWAContext);
    if (!context) {
        throw new Error('usePWA must be used within a PWAProvider');
    }
    return context;
};
