import { LruCache } from '../feed/LruCache';
import { bearingDeg, distanceMeters } from './geo';

/**
 * Headings derived from a vehicle's own movement, for feeds that report positions without one. Each
 * vehicle keeps its last heading until it has moved `minMoveM` from where that heading was taken.
 */
export class MovementBearings {
    private readonly lastFixes: LruCache<{ lat: number; lon: number; bearing: number | null }>;

    constructor(private readonly minMoveM: number, maxEntries: number) {
        this.lastFixes = new LruCache({ maxEntries });
    }

    /** The heading of the vehicle `key` now at `lat`/`lon`; null until it has moved far enough to tell. */
    bearing(key: string, lat: number, lon: number): number | null {
        const prev = this.lastFixes.get(key);
        if (!prev) {
            this.lastFixes.set(key, { lat, lon, bearing: null });
            return null;
        }
        if (distanceMeters(prev.lat, prev.lon, lat, lon) < this.minMoveM) return prev.bearing;
        const bearing = bearingDeg(prev.lat, prev.lon, lat, lon);
        this.lastFixes.set(key, { lat, lon, bearing });
        return bearing;
    }
}
