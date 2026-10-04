import { FALLBACK_ROUTE_COLOR } from '../config/constants';
import type { StopFeature } from '../types/transit';

/**
 * Builds an O(1) lookup map for line metadata from a list of stops.
 */
export const getLineMetadataMap = (stops: StopFeature[] | null): Map<string, { route_color: string; type: string }> => {
    const map = new Map<string, { route_color: string; type: string }>();
    if (!stops) return map;

    for (const stop of stops) {
        const lines = stop.properties.lines;
        if (!lines) continue;

        for (const line of lines) {
            const name = String(line.name).toUpperCase();
            if (!map.has(name)) {
                map.set(name, {
                    route_color: line.route_color || FALLBACK_ROUTE_COLOR,
                    type: line.type
                });
            }
        }
    }
    return map;
};

/**
 * Finds a line's metadata using an O(1) Map lookup.
 */
export const getLineMetadataFromMap = (name: string, metaMap: Map<string, { route_color: string; type: string }>) => {
    if (!name) return null;
    return metaMap.get(name.toUpperCase()) || null;
};

/**
 * Returns the i18n translation key for a given route type slug.
 */
export const getRouteTypeI18nKey = (type: string | undefined | null): string => {
    return type ? `settings.vehicleTypes.${type}` : '';
};

/**
 * Whether an alert priority (RSS string or GTFS-RT numeric code) is high.
 */
export const isHighPriorityAlert = (priority: string | undefined | null): boolean =>
    priority === 'high' || priority === '1';
