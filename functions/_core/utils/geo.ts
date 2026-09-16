const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => deg * Math.PI / 180;

/** Great-circle (haversine) distance in meters between two lat/lon points. */
export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(h));
}

/** Approximate distance in meters from a point to the segment A–B, on a local flat projection. */
export function distanceToSegmentMeters(lat: number, lon: number, aLat: number, aLon: number, bLat: number, bLon: number): number {
    const kx = Math.cos(toRad(lat)) * EARTH_RADIUS_M * Math.PI / 180;
    const ky = EARTH_RADIUS_M * Math.PI / 180;
    const [px, py] = [(lon - aLon) * kx, (lat - aLat) * ky];
    const [dx, dy] = [(bLon - aLon) * kx, (bLat - aLat) * ky];
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSq)) : 0;
    return Math.hypot(px - t * dx, py - t * dy);
}

/** Initial compass bearing in degrees (0-360, clockwise from north) from point A to point B. */
export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
    const y = Math.sin(toRad(bLon - aLon)) * Math.cos(toRad(bLat));
    const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) - Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLon - aLon));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
