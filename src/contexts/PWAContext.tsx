import React, { useEffect, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { PWAContext } from '../state/pwa-context';

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
