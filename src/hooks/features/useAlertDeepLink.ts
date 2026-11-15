import { useEffect } from 'react';
import { DISRUPTION_PROTOCOL } from '@shared/alerts';
import { replaceUrl } from '@/lib/history';
import { useUiStore } from '@/state/uiStore';

/** Opens the alert a disruption notification names (`?alert=<guid>`), then drops the parameter so a reload doesn't reopen it. */
export const useAlertDeepLink = () => {
    useEffect(() => {
        const url = new URL(window.location.href);
        const guid = url.searchParams.get(DISRUPTION_PROTOCOL.ALERT_PARAM);
        if (!guid) return;
        useUiStore.getState().actions.openAlert(guid);
        url.searchParams.delete(DISRUPTION_PROTOCOL.ALERT_PARAM);
        replaceUrl(url.toString());
    }, []);
};
