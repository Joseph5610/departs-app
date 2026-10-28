import { describe, expect, it } from 'vitest';
import { isInView, vehicleView } from './vehicleView';

const at = (route_type: string, route_short_name: string, coordinates: [number, number] | null) =>
    ({ geometry: coordinates && { coordinates }, properties: { route_type, route_short_name } });

describe('vehicle view', () => {
    it('shows the whole fleet when nothing is asked for', () => {
        expect(vehicleView([], null, null)).toBeNull();
    });

    // Types match case-insensitively, line names upper-cased; bounds are south,west,north,east.
    it('keeps a vehicle only when its type, line and position all match', () => {
        const view = vehicleView(['TRAM'], ['x9'], [50, 14, 50.2, 14.6])!;

        expect(isInView(view, at('tram', 'X9', [14.4, 50.1]))).toBe(true);
        expect(isInView(view, at('bus', 'X9', [14.4, 50.1]))).toBe(false);
        expect(isInView(view, at('tram', '22', [14.4, 50.1]))).toBe(false);
        expect(isInView(view, at('tram', 'X9', [16.6, 49.2]))).toBe(false);
        expect(isInView(view, at('tram', 'X9', [14.4, 50.5]))).toBe(false);
    });

    it('drops a vehicle without a position only when the view has bounds', () => {
        expect(isInView(vehicleView(['tram'], null, null)!, at('tram', '9', null))).toBe(true);
        expect(isInView(vehicleView(null, null, [50, 14, 50.2, 14.6])!, at('tram', '9', null))).toBe(false);
    });
});
