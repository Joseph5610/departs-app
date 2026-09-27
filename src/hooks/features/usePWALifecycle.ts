import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { usePWAStore } from '../../state/pwaStore';
import { usePreferencesStore } from '../../state/preferencesStore';

/**
 * Headless hook to manage the PWA lifecycle.
 * Handles service worker registration, state syncing to Zustand, update notifications and the install prompt.
 */
export const usePWALifecycle = () => {
    const { t } = useTranslation();
    const canInstall = usePWAStore(s => s.canInstall);
    const { promptInstall } = usePWAStore(s => s.actions);
    const { setHasSeenInstallPrompt } = usePreferencesStore(s => s.actions);

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
                state.needRefresh === needRefresh
            ) return state;

            return {
                offlineReady,
                needRefresh,
            };
        });
    }, [offlineReady, needRefresh]);

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

    // Offer installation once per device; afterwards Settings keeps an Install app entry
    useEffect(() => {
        if (!canInstall) {
            toast.dismiss('pwa-install');
            return;
        }
        if (usePreferencesStore.getState().hasSeenInstallPrompt) return;
        setHasSeenInstallPrompt(true);
        toast(t('install.title'), {
            description: t('install.description'),
            action: {
                label: t('install.button'),
                onClick: () => { void promptInstall(); },
            },
            closeButton: true,
            duration: Infinity,
            id: 'pwa-install',
        });
    }, [canInstall, promptInstall, setHasSeenInstallPrompt, t]);
};
