/**
 * Official PID Branding Colors
 */
export const VEHICLE_COLORS = {
    METRO_A: '#00A562',
    METRO_B: '#F8B322',
    METRO_C: '#CF003D',
    METRO_DEFAULT: '#AD0B00',
    TRAM: '#7A0603',
    BUS: '#007DA8',
    TROLLEYBUS: '#80166F',
    TRAIN: '#1c1745',
    NIGHT: '#262050',
    FALLBACK: '#5A5A5A'
} as const;

/**
 * Determines if a route is a night route based on its number.
 * Trams 90-99 and Buses 900+ are considered night routes.
 */
export const isNightRoute = (routeName: string | number | undefined): boolean => {
    const nameStr = String(routeName ?? '');
    const nameNum = parseInt(nameStr, 10);
    if (isNaN(nameNum)) return false;

    // Trams 90-99 (Exactly 2 digits)
    if (nameStr.length === 2 && nameNum >= 90 && nameNum <= 99) return true;

    // Buses 900-999 (Exactly 3 digits)
    if (nameStr.length === 3 && nameNum >= 900 && nameNum <= 999) return true;

    return false;
};

/**
 * Heuristic to guess the transit type (metro, tram, bus) from a line name/number.
 * Used for visual styling of alerts where explicit routeType is missing.
 */
export const guessType = (line: string): 'metro' | 'tram' | 'bus' => {
    const upperLine = line.toUpperCase();
    if (['A', 'B', 'C'].includes(upperLine)) {
        return 'metro';
    }
    const n = parseInt(line);
    if (!isNaN(n)) {
        if (n < 40) {
            return 'tram';
        }
        if (n >= 100) {
            return 'bus';
        }
    }
    return 'bus';
};

/**
 * Returns a hex color string for a given route type and name.
 * Uses PID official branding colors for Metro, Trams, and Buses.
 */
export const getVehicleColor = (routeType: string | number | undefined, routeName: string | undefined): string => {
    const type = String(routeType ?? '').toLowerCase();
    const nameStr = String(routeName ?? '');

    // 1. Metro Specifics (Priority)
    if (type === '1' || type === 'metro') {
        switch (nameStr.toUpperCase()) {
            case 'A': return VEHICLE_COLORS.METRO_A;
            case 'B': return VEHICLE_COLORS.METRO_B;
            case 'C': return VEHICLE_COLORS.METRO_C;
        }
    }

    // 2. Night Routes (Trams 90-99, Buses 900+)
    if (isNightRoute(nameStr)) {
        return VEHICLE_COLORS.NIGHT;
    }

    // 3. Fallback by Type
    switch (type) {
        case '0':
        case 'tram':
            return VEHICLE_COLORS.TRAM;
        case '1':
        case 'metro':
            return VEHICLE_COLORS.METRO_DEFAULT;
        case '11':
        case 'trolleybus':
            return VEHICLE_COLORS.TROLLEYBUS;
        case '3':
        case 'bus':
            return VEHICLE_COLORS.BUS;
        case '109':
        case 'train':
            return VEHICLE_COLORS.TRAIN;
        default:
            return VEHICLE_COLORS.FALLBACK;
    }
};
