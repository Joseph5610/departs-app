/**
 * Alert rules the app and the server's disruption watch both apply, so the badge and the pushes agree.
 * Plain TypeScript without imports: both builds compile it.
 */

export const ALERT_RULES = {
    /** An incident without an end that started longer ago than this is a leftover, not a disruption now. */
    INCIDENT_STALE_AFTER_MS: 7 * 24 * 3600_000,
};

/** The push protocol between the app and the server's disruption watch. */
export const DISRUPTION_PROTOCOL = {
    /** Placeholder in the notification title the server puts the affected line names into. */
    LINES_TOKEN: '{lines}',
    /** Notification tag prefix, per alert, so one alert never notifies twice on a device. */
    TAG: 'disruption',
    /** Query parameter of the page a notification opens, naming the alert to show. */
    ALERT_PARAM: 'alert',
    /** Pinned lines one subscription may watch. */
    MAX_LINES: 80,
    /** Keys (route ids, name, KORDIS numeric ids) one watched line may carry. */
    MAX_KEYS_PER_LINE: 8,
};

/** A pinned line and the keys an alert may name it by (route ids, upper-cased name, KORDIS numeric ids), as the app resolved them. */
export interface WatchedLine {
    name: string;
    keys: string[];
}

/** An alert's validity window as the alerts API sends it (ISO 8601 instants). */
export interface AlertWindow {
    valid_from: string | null;
    valid_to: string | null;
}

/** Where an alert's window stands at `nowMs`; one without dates (KORDIS) is current while it is published. */
export type AlertPhase = 'upcoming' | 'current' | 'stale' | 'ended';

export const alertPhase = ({ valid_from, valid_to }: AlertWindow, nowMs: number): AlertPhase => {
    const fromMs = valid_from ? Date.parse(valid_from) : Number.NaN;
    const toMs = valid_to ? Date.parse(valid_to) : Number.NaN;
    if (fromMs > nowMs) return 'upcoming';
    if (toMs < nowMs) return 'ended';
    if (Number.isNaN(toMs) && nowMs - fromMs > ALERT_RULES.INCIDENT_STALE_AFTER_MS) return 'stale';
    return 'current';
};
