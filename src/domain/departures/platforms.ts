import type { Departure, StopFeature } from '@/types';
import { mapStable } from '@/lib/memoize';

/** Marks a boarding key that names a platform by its direction, so it never equals a platform code. */
const DIRECTION_KEY_PREFIX = '→';

/** Where a departure boards on a station board: its platform code, else the direction its platform serves, else ''. */
export const boardingKey = (dep: Pick<Departure, 'platform' | 'platformDirection'>): string =>
    dep.platform ?? (dep.platformDirection ? `${DIRECTION_KEY_PREFIX}${dep.platformDirection}` : '');

/**
 * Departures a feed sends with only their platform's stop id (IDS JMK, DPMP, DÚK), given that platform's
 * code from the stop list, or, for a platform without one, the direction it serves.
 */
export const withStopPlatforms = (departures: Departure[], stopIndex: ReadonlyMap<string, StopFeature>): Departure[] =>
    mapStable(departures, dep => {
        const platformId = dep.platformStopId ?? dep.stopId;
        if (dep.platform || !platformId) return dep;
        const stop = stopIndex.get(platformId)?.properties;
        if (stop?.platform_code) return { ...dep, platform: stop.platform_code };
        if (stop?.direction) return { ...dep, platformDirection: stop.direction };
        return dep;
    });
