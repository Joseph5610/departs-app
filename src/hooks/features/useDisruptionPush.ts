import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { CITY_LIST } from '@/config/cities';
import { DISRUPTION_PUSH_CONFIG } from '@/config/constants';
import { DISRUPTION_PROTOCOL, type WatchedLine } from '@shared/alerts';
import { alertKeysOfLines, disruptionSyncKey, disruptionSyncSteps, incidentsOnLines, type CityWatch } from '@/domain/alerts';
import { pinnedLineNames } from '@/domain/departures';
import { useAlerts } from '@/hooks/data/useAlerts';
import { useRouteMetadata, useRouteMetadataOf } from '@/hooks/data/useRouteMetadata';
import { backgroundEndpoint, pushEndpoint, setAppBadge, startDisruptionPush, stopDisruptionPush, subscribePush } from '@/lib/push';
import { paths } from '@/lib/routes';
import { usePreferencesStore } from '@/state/preferencesStore';

const ALERT_CITIES = CITY_LIST.filter(city => city.hasAlerts).map(city => city.slug);

const pushTitle = (t: TFunction) => t('disruptionPush.title', { lines: DISRUPTION_PROTOCOL.LINES_TOKEN });

const preferences = () => usePreferencesStore.getState();

let queue: Promise<void> = Promise.resolve();

/** Runs sync work one task at a time, so each sees what the one before it recorded (an unpin during the first add still withdraws it). */
const serially = (task: () => Promise<void>) => {
    queue = queue.then(task, task);
};

/** Brings the server in line with the pins of every city. Never asks for permission; with it gone it turns the switch off, so the switch doesn't lie. */
const reconcile = async (watches: readonly CityWatch[], title: string, onLost: () => void) => {
    if (!preferences().disruptionPush) return;
    const { endpoint, lost } = await backgroundEndpoint();
    if (lost) {
        preferences().actions.setDisruptionPush(false);
        onLost();
        return;
    }
    if (!endpoint) return;
    const steps = disruptionSyncSteps(watches, preferences().disruptionPushSync, {
        endpoint, title, pathOf: paths.city, now: Date.now(), renewAfterMs: DISRUPTION_PUSH_CONFIG.RENEW_AFTER_MS,
    });
    const { markDisruptionPushSynced } = preferences().actions;
    for (const step of steps) {
        if (!preferences().disruptionPush) return;
        if (step.action === 'remove') {
            if (await stopDisruptionPush(step.city)) markDisruptionPushSynced(step.city, null);
            continue;
        }
        const result = await startDisruptionPush(step.city, step.lines, title, step.path, false);
        if (!result.ok) continue;
        // Switched off while this was on its way: nothing recorded it, so nothing else would withdraw it.
        if (preferences().disruptionPush) markDisruptionPushSynced(step.city, { key: step.key, at: Date.now() });
        else await stopDisruptionPush(step.city);
    }
};

/** Withdraws every city the server still pushes to this device; one that fails stays recorded for the next try. */
const withdrawAll = async () => {
    for (const city of Object.keys(preferences().disruptionPushSync)) {
        if (preferences().disruptionPush) return;
        if (await stopDisruptionPush(city)) preferences().actions.markDisruptionPushSynced(city, null);
    }
};

/**
 * While disruption push is on: keeps the server's copy of every city's pinned lines current (after a change, on each
 * return to the app, renewed weekly) and shows the selected city's current incidents on them on the app icon.
 */
export const useDisruptionPush = () => {
    const { t } = useTranslation();
    const city = usePreferencesStore(s => s.selectedCity);
    const favoriteLines = usePreferencesStore(s => s.favoriteLines);
    const syncedCities = usePreferencesStore(s => Object.keys(s.disruptionPushSync).sort().join());
    const { alerts, dataUpdatedAt } = useAlerts();

    const pinned = useMemo(() => ALERT_CITIES.map(slug => ({ city: slug, names: pinnedLineNames(favoriteLines, slug) })).filter(({ names }) => names.length > 0), [favoriteLines]);
    const pinnedCities = useMemo(() => pinned.map(watch => watch.city), [pinned]);
    const metadata = useRouteMetadataOf(pinnedCities);
    const watches = useMemo<CityWatch[]>(() => pinned.map(({ city: slug, names }) => {
        const routes = metadata.get(slug);
        return { city: slug, lines: routes ? alertKeysOfLines(names, routes.byId, routes.byName) : null };
    }), [pinned, metadata]);

    useEffect(() => {
        const title = pushTitle(t);
        const onLost = () => toast(t('disruptionPush.failed'), { description: t('disruptionPush.denied') });
        let timer: ReturnType<typeof setTimeout>;
        const schedule = () => {
            clearTimeout(timer);
            if (document.visibilityState !== 'visible') return;
            timer = setTimeout(() => serially(() => reconcile(watches, title, onLost)), DISRUPTION_PUSH_CONFIG.SYNC_DEBOUNCE_MS);
        };
        schedule();
        document.addEventListener('visibilitychange', schedule);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', schedule);
        };
    }, [watches, syncedCities, t]);

    const badge = useMemo(() => (alerts ? incidentsOnLines(alerts, new Set(pinnedLineNames(favoriteLines, city))).length : null), [alerts, favoriteLines, city]);
    useEffect(() => {
        if (badge === null) return;
        const apply = () => {
            if (document.visibilityState === 'visible') void setAppBadge(badge);
        };
        apply();
        // A push sets the icon behind the app's back, so every alerts read and every return to the app puts its own count back.
        document.addEventListener('visibilitychange', apply);
        return () => document.removeEventListener('visibilitychange', apply);
    }, [badge, dataUpdatedAt]);
};

/** While disruption push is off: clears the app icon and withdraws what the server still holds, retrying when back online. */
export const useDisruptionPushOff = () => {
    const hasSynced = usePreferencesStore(s => Object.keys(s.disruptionPushSync).length > 0);

    useEffect(() => {
        void setAppBadge(0);
    }, []);

    useEffect(() => {
        if (!hasSynced) return;
        const retry = () => serially(withdrawAll);
        retry();
        window.addEventListener('online', retry);
        return () => window.removeEventListener('online', retry);
    }, [hasSynced]);
};

/** Turns disruption push on (from a tap: it may ask for notification permission) or off. */
export const useDisruptionPushToggle = () => {
    const { t } = useTranslation();
    const { setDisruptionPush, markDisruptionPushSynced } = usePreferencesStore(s => s.actions);
    const city = usePreferencesStore(s => s.selectedCity);
    const favoriteLines = usePreferencesStore(s => s.favoriteLines);
    const { byId, byName } = useRouteMetadata();
    const lines = useMemo<WatchedLine[] | null>(() => (byId.size > 0 ? alertKeysOfLines(pinnedLineNames(favoriteLines, city), byId, byName) : null), [favoriteLines, city, byId, byName]);
    const isBusy = useRef(false);

    return useCallback(async (on: boolean) => {
        // The switch sits inside its row's button, so one tap can arrive twice.
        if (isBusy.current) return;
        isBusy.current = true;
        try {
            if (!on) {
                // `useDisruptionPushOff` withdraws the server's copies, and retries those that fail.
                setDisruptionPush(false);
                return;
            }
            const title = pushTitle(t);
            const path = paths.city(city);
            const result = lines?.length
                ? await startDisruptionPush(city, lines, title, path, true)
                : await subscribePush();
            if (!result.ok) {
                toast(t('disruptionPush.failed'), { description: failureText(result.reason, t) });
                return;
            }
            setDisruptionPush(true);
            const endpoint = await pushEndpoint();
            if (endpoint && lines?.length) markDisruptionPushSynced(city, { key: disruptionSyncKey(endpoint, lines, title, path), at: Date.now() });
        } finally {
            isBusy.current = false;
        }
    }, [city, lines, setDisruptionPush, markDisruptionPushSynced, t]);
};

const failureText = (reason: string, t: TFunction): string => {
    if (reason === 'unsupported') return t('disruptionPush.unsupported');
    if (reason === 'tooMany') return t('disruptionPush.tooMany');
    if (reason.startsWith('NotAllowedError')) return t('disruptionPush.denied');
    return reason;
};
