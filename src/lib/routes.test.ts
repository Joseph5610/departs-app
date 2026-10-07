import { describe, expect, it } from 'vitest';
import { matchRoutePath, withCitySegment } from './routes';

describe('withCitySegment', () => {
    // Panning into another network re-homes the open URL without losing what it points at.
    it('swaps the city and keeps the rest of the path', () => {
        expect(withCitySegment('/prague/stop/U1040Z1P', 'duk')).toBe('/duk/stop/U1040Z1P');
        expect(withCitySegment('/', 'brno')).toBe('/brno');
    });
});

describe('matchRoutePath', () => {
    it('decodes ids that carry reserved characters', () => {
        expect(matchRoutePath('/prague/stop/a%2Fb')).toMatchObject({ city: 'prague', stopId: 'a/b' });
    });
});
