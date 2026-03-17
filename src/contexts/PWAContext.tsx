import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface PWAContextValue {
    offlineReady: boolean;
    setOfflineReady: (ready: boolean) => void;
    needRefresh: boolean;
    setNeedRefresh: (refresh: boolean) => void;
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

const PWAContext = createContext<PWAContextValue | null>(null);

export const PWAProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useTranslation();
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    useEffect(() => {
        if (needRefresh) {
            toast.info(t('update.newVersion'), {
                description: t('update.updateNow'),
                action: {
                    label: t('update.updateButton'),
                    onClick: () => updateServiceWorker(true),
                },
                duration: Infinity,
                id: 'pwa-update',
            });
        }
    }, [needRefresh, updateServiceWorker, t]);


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
