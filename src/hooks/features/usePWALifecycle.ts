import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { usePWAStore } from '../../state/pwaStore';

/**
 * Headless hook to manage the PWA lifecycle.
 * Handles service worker registration, state syncing to Zustand, and update notifications.
 */
export const usePWALifecycle = () => {
    const { t } = useTranslation();

    const {
        offlineReady: [offlineReady],
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    // Sync SW state to Zustand store
    useEffect(() => {
        usePWAStore.setState((state) => {
            if (
                state.offlineReady === offlineReady &&
                state.needRefresh === needRefresh &&
                state.actions.updateServiceWorker === updateServiceWorker
            ) return state;

            return {
                offlineReady,
                needRefresh,
                actions: {
                    ...state.actions,
                    updateServiceWorker
                }
            };
        });
    }, [offlineReady, needRefresh, updateServiceWorker]);

    // Show update notification when a new version is available
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
};
