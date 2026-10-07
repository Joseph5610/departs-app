export const EARTH_RADIUS_M = 6_371_000;
export const DEG = Math.PI / 180;

/** A real position: present and not the feeds' `[0, 0]` placeholder. */
export const hasPosition = (coords: readonly number[] | null | undefined): coords is [number, number] =>
    !!coords && (coords[0] !== 0 || coords[1] !== 0);

/**
 * Calculates the Haversine distance between two points in meters.
 */
export const calculateDistance = (pos1: [number, number], pos2: [number, number]): number => {
    const [lon1, lat1] = pos1;
    const [lon2, lat2] = pos2;
    const φ1 = lat1 * DEG;
    const φ2 = lat2 * DEG;
    const Δφ = (lat2 - lat1) * DEG;
    const Δλ = (lon2 - lon1) * DEG;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_M * c;
};
