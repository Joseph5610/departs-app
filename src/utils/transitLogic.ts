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
 * Average walking speed in m/s (3.6 km/h)
 * Adjusted for urban environments.
 */
export const WALKING_SPEED = 1.0;

/**
 * Buffer time in seconds to account for platform navigation, ticket validation, etc.
 */
export const CATCH_BUFFER = 120;

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
