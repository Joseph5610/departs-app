/**
 * Helper: convert HH:MM:SS to seconds of day
 */
export const toSecs = (t: string) => { 
    const [h, m, s] = t.split(':').map(Number); 
    return h * 3600 + m * 60 + (s || 0); 
};

/**
 * Midnight crossover fix.
 * Helps to compare times accurately around midnight.
 */
export const crossFix = (a: number, b: number) => {
    if (a < 14400 && b > 72000) return a + 86400;
    if (a > 72000 && b < 14400) return a - 86400;
    return a;
};

/**
 * Haversine formula to calculate the great-circle distance between two points.
 * This is significantly more accurate than flat-earth projection for geographic coordinates.
 * Returns distance in meters.
 */
export const haversineDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Helper to fetch data with a standardized User-Agent to bypass restrictive firewalls (e.g. Cloudflare)
 */
export const gtfsFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    if (!headers.has('User-Agent')) {
        headers.set('User-Agent', 'departs-app-backend/1.0');
    }
    
    const res = await fetch(url, { ...init, headers });
    
    if (!res.ok) {
        throw new Error(`GTFS fetch failed: ${res.status} ${res.statusText} for ${url}`);
    }
    
    return res;
};
