/**
 * DÚK (Ústecký kraj) Branding Colors
 */
const VEHICLE_COLORS = {
    BUS: '#7BBA2E', // DÚK Green
    TRAIN: '#004B90', // CD/GWTR Blue
    TROLLEYBUS: '#00829B',
    TRAM: '#CF003D',
    FERRY: '#00B3CB',
    FALLBACK: '#5A5A5A'
} as const;

/**
 * Returns a hex color string for a given route type and name.
 */
export const getDukVehicleColor = (routeType: string | undefined, _routeName: string | undefined): string => {
    const type = routeType ?? '';
    
    // Fallback by Type
    switch (type) {
        case 'bus':
            return VEHICLE_COLORS.BUS;
        case 'train':
            return VEHICLE_COLORS.TRAIN;
        case 'trolleybus':
            return VEHICLE_COLORS.TROLLEYBUS;
        case 'tram':
            return VEHICLE_COLORS.TRAM;
        case 'ferry':
            return VEHICLE_COLORS.FERRY;
        default:
            return VEHICLE_COLORS.FALLBACK;
    }
};
