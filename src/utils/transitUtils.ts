import { WALKING_SPEED, CATCH_BUFFER } from '../config/constants';
import { VEHICLE_COLORS } from '../config/colors';

/**
 * guessType
 * 
 * Heuristic to guess the transit type (metro, tram, bus) from a line name/number.
 * Used for visual styling of alerts and other elements where explicit routeType is missing.
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

export type CatchStatus = 'success' | 'warning' | 'error';

/**
 * Determines the catchability of a departure based on distance and time.
 */
export const getCatchStatus = (
    distanceMeters: number,
    departureTimestamp: string,
    isAtStop: boolean = false
): { status: CatchStatus; walkingTimeMin: number } => {
    const now = Date.now();
    const depTime = new Date(departureTimestamp).getTime();
    const walkingTimeSec = distanceMeters / WALKING_SPEED;
    const totalRequiredTimeSec = walkingTimeSec + CATCH_BUFFER;

    const remainingTimeSec = (depTime - now) / 1000;

    let status: CatchStatus = 'success';

    if (isAtStop) {
        // If at stop, it's a success as long as it hasn't left yet
        status = remainingTimeSec >= 0 ? 'success' : 'error';
    } else {
        if (remainingTimeSec < walkingTimeSec) {
            status = 'error';
        } else if (remainingTimeSec < totalRequiredTimeSec) {
            status = 'warning';
        }
    }

    return {
        status,
        walkingTimeMin: Math.ceil(walkingTimeSec / 60)
    };
};
