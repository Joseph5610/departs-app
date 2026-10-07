import { describe, expect, it } from 'vitest';
import type { RouteInfo } from '@/types';
import { indexRouteMetadata, NO_TYPE_COLORS } from './metadata';
import { routeJoinKey } from './routeType';

const routes: Record<string, RouteInfo> = {
    L120D99: { name: '120', type: 'bus', route_color: '007DA8' },
    L99D99: { name: 'N99', type: 'bus', route_color: '1E1E1E' },
    L70D1: { name: '70', type: 'trolleybus', route_color: '80166F' },
};

describe('indexRouteMetadata', () => {
    // A train line the routes file doesn't list still gets the city's train colour.
    it('answers an unlisted line with its mode colour, but only where the city defines one', () => {
        const { byShortName } = indexRouteMetadata(routes, { train: '004B90' });

        expect(byShortName.get(routeJoinKey('train', 'S49'))).toEqual({ name: 'S49', type: 'train', route_color: '004B90' });
        expect(byShortName.get(routeJoinKey('tram', '4'))).toBeUndefined();
        expect(byShortName.get(routeJoinKey('trolleybus', '70'))?.route_color).toBe('80166F');
    });

    // KORDIS alerts carry "120" where routes.json keys the route as "L120D99".
    it('indexes KORDIS ids by their numeric segment', () => {
        const { byKordisNumeric, byName } = indexRouteMetadata(routes, NO_TYPE_COLORS);

        expect(byKordisNumeric.get('120')?.name).toBe('120');
        expect(byKordisNumeric.get('99')?.name).toBe('N99');
        expect(byName.get('N99')?.route_color).toBe('1E1E1E');
    });
});
