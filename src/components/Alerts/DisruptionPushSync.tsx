import { useAlertDeepLink } from '@/hooks/features/useAlertDeepLink';
import { useDisruptionPush, useDisruptionPushOff } from '@/hooks/features/useDisruptionPush';
import { usePreferencesStore } from '@/state/preferencesStore';

const PushOn = () => {
    useDisruptionPush();
    return null;
};

const PushOff = () => {
    useDisruptionPushOff();
    return null;
};

/** Disruption push and the alert a notification opens, in their own components: alerts polls don't re-render the app, and with push off nothing is read. */
export const DisruptionPushSync = () => {
    useAlertDeepLink();
    const isOn = usePreferencesStore(s => s.disruptionPush);
    return isOn ? <PushOn /> : <PushOff />;
};
