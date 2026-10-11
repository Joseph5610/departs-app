import { describe, expect, it } from 'vitest';
import { primaryRouteType } from './routeType';

describe('primaryRouteType', () => {
    // A stop served by metro and trams is shown as a metro stop; mode order decides, not line order.
    it('picks the leading mode in mode order, normalising GTFS numbers', () => {
        expect(primaryRouteType(['bus', 'tram', 1])).toBe('metro');
        expect(primaryRouteType([3, 'trolleybus'])).toBe('trolleybus');
        expect(primaryRouteType([])).toBe('unknown');
    });
});
