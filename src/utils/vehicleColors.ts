import type { ExpressionSpecification } from 'maplibre-gl';

/**
 * Official PID Branding Colors
 */
export const VEHICLE_COLORS = {
    METRO_A: '#4EB370',
    METRO_B: '#EEAD00',
    METRO_C: '#C10141',
    METRO_DEFAULT: '#AD0B00',
    TRAM: '#8b0511',
    BUS: '#1C6078',
    TROLLEYBUS: '#A21CAF',
    TRAIN: '#002D5A',
    NIGHT: '#180B5C',
    FALLBACK: '#5A5A5A'
} as const;

/**
 * Determines if a route is a night route based on its number.
 * Trams 90-99 and Buses 900+ are considered night routes.
 */
export const isNightRoute = (routeName: string | number): boolean => {
    const nameStr = String(routeName);
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
 * MapLibre expression to detect night routes in vector layers.
 * Synchronized with isNightRoute logic.
 */
export const isNightRouteExpression: ExpressionSpecification = [
    'any',
    // Trams 90-99
    ['match', ['to-string', ['coalesce', ['get', 'route_short_name'], '']], ['90', '91', '92', '93', '94', '95', '96', '97', '98', '99'], true, false],
    // Buses 9xx (Length 3, Starts with 9)
    ['all',
        ['==', ['length', ['to-string', ['coalesce', ['get', 'route_short_name'], '']]], 3],
        ['==', ['slice', ['to-string', ['coalesce', ['get', 'route_short_name'], '']], 0, 1], '9']
    ]
];

/**
 * MapLibre expression for dynamic vehicle coloring based on route type and name.
 * Used for styling 'pid-vehicles' and 'selected-vehicle' sources.
 */
export const vehicleColorExpression: ExpressionSpecification = [
    'case',
    // 1. Metro Specifics (Priority)
    ['any',
        ['==', ['to-string', ['get', 'route_short_name']], 'A'],
        ['==', ['to-string', ['get', 'n']], 'A']
    ], VEHICLE_COLORS.METRO_A,
    ['any',
        ['==', ['to-string', ['get', 'route_short_name']], 'B'],
        ['==', ['to-string', ['get', 'n']], 'B']
    ], VEHICLE_COLORS.METRO_B,
    ['any',
        ['==', ['to-string', ['get', 'route_short_name']], 'C'],
        ['==', ['to-string', ['get', 'n']], 'C']
    ], VEHICLE_COLORS.METRO_C,

    // 2. Night Routes Detection (90-99 or 9xx)
    isNightRouteExpression, VEHICLE_COLORS.NIGHT,

    // 3. Type-based fallback
    ['match', ['to-string', ['coalesce', ['get', 'route_type'], '']],
        '0', VEHICLE_COLORS.TRAM, 'tram', VEHICLE_COLORS.TRAM,
        '1', VEHICLE_COLORS.METRO_DEFAULT, 'metro', VEHICLE_COLORS.METRO_DEFAULT,
        '3', VEHICLE_COLORS.BUS, 'bus', VEHICLE_COLORS.BUS,
        '11', VEHICLE_COLORS.TROLLEYBUS, 'trolleybus', VEHICLE_COLORS.TROLLEYBUS,
        '109', VEHICLE_COLORS.TRAIN, 'train', VEHICLE_COLORS.TRAIN,
        VEHICLE_COLORS.FALLBACK
    ]
];
