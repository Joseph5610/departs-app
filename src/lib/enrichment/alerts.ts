import type { RSSItem } from '../../types/alerts';
import type { RouteInfo } from '../../types/vehicles';
import { normalizeRouteType } from '../../utils/routeTypes';

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

    let changed = false;
    const result = alerts.map((alert): RSSItem => {
        if (!alert.line_metadata?.length) return alert;

        let lineMetadataChanged = false;
        const nextLineMetadata = alert.line_metadata.map((entry) => {
            const key = entry.route_id ?? entry.name;
            if (!key) return entry;
            const upper = key.toUpperCase();
            const route = (entry.route_id && byId.get(entry.route_id)) || byName.get(upper) || byKordisNumeric.get(upper);
            lineMetadataChanged = true;
            return route
                ? { ...entry, name: route.name, type: normalizeRouteType(route.type), route_color: route.route_color }
                : { ...entry, name: entry.name ?? key, type: entry.type ?? 'unknown' as const };
        });

        if (!lineMetadataChanged) return alert;
        changed = true;
        return { ...alert, line_metadata: nextLineMetadata };
    });

    return changed ? result : alerts;
}

/** Alerts with `isActive`/`isFuture` as of `nowMs`, from their validity window; an alert without dates is active. */
export function withAlertTiming(alerts: RSSItem[], nowMs: number): RSSItem[] {
    return alerts.map((alert) => {
        const isFuture = !!alert.valid_from && Date.parse(alert.valid_from) > nowMs;
        const hasEnded = !!alert.valid_to && Date.parse(alert.valid_to) < nowMs;
        return { ...alert, isActive: !isFuture && !hasEnded, isFuture };
    });
}
