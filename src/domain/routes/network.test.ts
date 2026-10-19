import { describe, expect, it } from 'vitest';
import type { NetworkLineCollection, RouteType } from '@/types';
import { colorNetwork } from './network';
import { hasDrawnLine } from './layer';

const MODE_COLORS = { tram: '#D40000', trolleybus: '#13856B', metro: '#E8710A' } as Record<RouteType, string>;

const network = (...properties: NetworkLineCollection['features'][number]['properties'][]): NetworkLineCollection => ({
    type: 'FeatureCollection',
    features: properties.map(p => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: p })),
});

describe('colorNetwork', () => {
    it('paints merged pieces in their mode colour, GTFS extended types included', () => {
        const { lines } = colorNetwork(network({ route_type: 0 }, { route_type: 800 }), MODE_COLORS);
        expect(lines.features.map(f => f.properties.route_color)).toEqual(['#D40000', '#13856B']);
    });

    // A metro line keeps its own colour (A green, B yellow), not the mode's.
    it('keeps a line its own colour and lists each colour once', () => {
        const { lines, colors } = colorNetwork(network({ route_type: 1, name: 'A', route_color: '#00A562' }, { route_type: 0 }, { route_type: 0 }), MODE_COLORS);
        expect(lines.features[0]!.properties.route_color).toBe('#00A562');
        expect(colors).toEqual(['#00A562', '#D40000']);
    });
});

describe('hasDrawnLine', () => {
    // The network keeps the selected metro line until the trip's own line can replace it, so nothing blinks out.
    it('is false while the shape loads and true once the line has points', () => {
        const layer = (coordinates: [number, number][]) => ({ type: 'FeatureCollection' as const, features: [
            { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [0, 0] } },
            { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } },
        ] });
        expect(hasDrawnLine(layer([]))).toBe(false);
        expect(hasDrawnLine(layer([[0, 0], [1, 1]]))).toBe(true);
        expect(hasDrawnLine(null)).toBe(false);
    });
});
