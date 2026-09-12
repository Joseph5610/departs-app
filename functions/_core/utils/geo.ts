const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => deg * Math.PI / 180;

/** Great-circle (haversine) distance in meters between two lat/lon points. */
export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(h));
}

/** Initial compass bearing in degrees (0-360, clockwise from north) from point A to point B. */
export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
    const y = Math.sin(toRad(bLon - aLon)) * Math.cos(toRad(bLat));
    const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) - Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLon - aLon));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
