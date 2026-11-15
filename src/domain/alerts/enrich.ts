import type { AlertLine, RSSItem, RouteInfo } from '@/types';
import { resolveLine } from '@shared/lines';
import { alertPhase } from '@shared/alerts';
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

/**
 * Alerts with `isActive`/`isFuture` as of `nowMs`, from their validity window; an alert without dates is active.
 * An incident open-ended for too long is also `isStale`: still listed, but no disruption now.
 */
export function withAlertTiming(alerts: RSSItem[], nowMs: number): RSSItem[] {
    return alerts.map((alert) => {
        const phase = alertPhase(alert, nowMs);
        const isStale = alert.type === 'incident' && phase === 'stale';
        return { ...alert, isActive: phase === 'current' || phase === 'stale', isFuture: phase === 'upcoming', isStale };
    });
}
