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
 * Returns the i18n translation key for a given GTFS route_type.
 * Handles both standard GTFS types (0-12) and extended Google Transit types (100-999).
 */
export const getRouteTypeI18nKey = (type: number | string | undefined): string => {
    if (type === undefined || type === null) return '';
    const strType = String(type).toLowerCase();
    if (['tram', 'metro', 'train', 'bus', 'ferry', 'funicular', 'trolleybus'].includes(strType)) {
        return `settings.vehicleTypes.${strType}`;
    }

    const n = Number(type);
    if (Number.isNaN(n)) return strType;

    if (n >= 100 && n <= 199) return 'settings.vehicleTypes.train';
    if (n >= 700 && n <= 799) return 'settings.vehicleTypes.bus';
    if (n >= 800 && n <= 899) return 'settings.vehicleTypes.trolleybus';
    if (n >= 900 && n <= 999) return 'settings.vehicleTypes.tram';
    switch (n) {
        case 0: return 'settings.vehicleTypes.tram';
        case 1: return 'settings.vehicleTypes.metro';
        case 2: return 'settings.vehicleTypes.train';
        case 3: return 'settings.vehicleTypes.bus';
        case 4: return 'settings.vehicleTypes.ferry';
        case 7: return 'settings.vehicleTypes.funicular';
        case 11: return 'settings.vehicleTypes.trolleybus';
        default: return '';
    }
};
