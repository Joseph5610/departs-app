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
 * Calculates the Haversine distance between two points in meters.
 */
export const calculateDistance = (pos1: [number, number], pos2: [number, number]): number => {
    const [lon1, lat1] = pos1;
    const [lon2, lat2] = pos2;
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/**
 * Normalizes a GTFS route_type (numeric GTFS 0-12, extended 100-999, or string) to a vehicle type slug.
 */
export const getRouteTypeSlug = (type: number | string | undefined | null): string => {
    if (type === undefined || type === null) return '';
    const strType = String(type).toLowerCase();
    if (['tram', 'metro', 'train', 'bus', 'ferry', 'funicular', 'trolleybus'].includes(strType)) {
        return strType;
    }

    const n = Number(type);
    if (Number.isNaN(n)) return strType;

    if (n >= 100 && n <= 199) return 'train';
    if (n >= 700 && n <= 799) return 'bus';
    if (n >= 800 && n <= 899) return 'trolleybus';
    if (n >= 900 && n <= 999) return 'tram';
    switch (n) {
        case 0: return 'tram';
        case 1: return 'metro';
        case 2: return 'train';
        case 3: return 'bus';
        case 4: return 'ferry';
        case 7: return 'funicular';
        case 11: return 'trolleybus';
        default: return strType;
    }
};

/**
 * Returns the i18n translation key for a given GTFS route_type.
 */
export const getRouteTypeI18nKey = (type: number | string | undefined | null): string => {
    const slug = getRouteTypeSlug(type);
    return slug ? `settings.vehicleTypes.${slug}` : '';
};
