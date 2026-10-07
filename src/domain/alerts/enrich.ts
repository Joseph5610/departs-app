import type { RSSItem, RouteInfo } from '@/types';
import { normalizeRouteType } from '@/domain/routes/routeType';
import { mapStable } from '@/lib/memoize';

/**
 * Resolves each alert's affected lines. GTFS-RT entries carry only `route_id`, looked up by id and
 * then in KORDIS's numeric-id table; RSS entries already carry name/type and only pick up a colour.
 */
export function enrichAlertLineMetadata(
    alerts: RSSItem[],
    byId: Map<string, RouteInfo>,
    byName: Map<string, RouteInfo>,
    byKordisNumeric: Map<string, RouteInfo>,
): RSSItem[] {
    if (!alerts.length || (byId.size === 0 && byName.size === 0)) return alerts;

    return mapStable(alerts, (alert) => {
        if (!alert.line_metadata?.length) return alert;
        const line_metadata = mapStable(alert.line_metadata, (entry) => {
            const key = entry.route_id ?? entry.name;
            if (!key) return entry;
            const upper = key.toUpperCase();
            const route = (entry.route_id && byId.get(entry.route_id)) || byName.get(upper) || byKordisNumeric.get(upper);
            return route
                ? { ...entry, name: route.name, type: normalizeRouteType(route.type), route_color: route.route_color }
                : { ...entry, name: entry.name ?? key, type: entry.type ?? 'unknown' as const };
        });
        return line_metadata === alert.line_metadata ? alert : { ...alert, line_metadata };
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
