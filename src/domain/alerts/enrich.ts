import type { AlertLine, RSSItem, RouteInfo } from '@/types';
import { resolveLine } from '@shared/lines';
import { mapStable } from '@/lib/memoize';

/** Resolves each alert's `lines` into `resolvedLines`: by route id, then by name, then in KORDIS's numeric-id table. */
export function resolveAlertLines(
    alerts: RSSItem[],
    byId: Map<string, RouteInfo>,
    byName: Map<string, RouteInfo>,
    byKordisNumeric: Map<string, RouteInfo>,
): RSSItem[] {
    if (!alerts.length || (byId.size === 0 && byName.size === 0)) return alerts;

    return mapStable(alerts, (alert) => {
        if (!alert.lines?.length) return alert;
        const resolvedLines = alert.lines.map((line): AlertLine => {
            const route = resolveLine(line, byId, byName, byKordisNumeric);
            return route ? { name: route.name, type: route.type, route_color: route.route_color } : { name: line, type: 'unknown' };
        });
        return { ...alert, resolvedLines };
    });
}

/** Alerts with `isActive`/`isFuture` as of `nowMs`, from their validity window; an alert without dates is active. */
export function withAlertTiming(alerts: RSSItem[], nowMs: number): RSSItem[] {
    return alerts.map((alert) => {
        const isFuture = !!alert.valid_from && Date.parse(alert.valid_from) > nowMs;
        const hasEnded = !!alert.valid_to && Date.parse(alert.valid_to) < nowMs;
        return { ...alert, isActive: !isFuture && !hasEnded, isFuture };
    });
}
