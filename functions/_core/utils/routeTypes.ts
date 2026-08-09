import type { AppRouteType } from '../types';

/**
 * Normalizes a GTFS route_type (numeric GTFS 0-12, extended 100-999, or string) to a vehicle type slug.
 * Returns one of: 'tram', 'metro', 'train', 'bus', 'ferry', 'funicular', 'trolleybus', or 'unknown'.
 */
export const normalizeRouteType = (type: number | string | undefined | null): AppRouteType => {
    if (type === undefined || type === null) return 'unknown';
    const strType = String(type).toLowerCase();
    
    // If it's already a valid slug, return it
    if (['tram', 'metro', 'train', 'bus', 'ferry', 'funicular', 'trolleybus'].includes(strType)) {
        return strType as AppRouteType;
    }

    const n = Number(type);
    if (Number.isNaN(n)) return (strType || 'unknown') as AppRouteType;

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
        default: return 'unknown';
    }
};
