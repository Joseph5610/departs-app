import { describe, expect, it } from 'vitest';
import { NOW, vehicle } from '@/test/factories';
import { enrichAlertLineMetadata } from './alerts';
import { enrichVehicleCollection } from './realtime';
import { routeJoinKey } from './routes';
import { enrichConnections, enrichVehicleRouteMetadata } from './vehicles';

// The map and panels re-render on identity, so an enrichment that changes nothing must hand back its input.
describe('enrichment keeps identity when nothing applies', () => {
    const fleet = { type: 'FeatureCollection' as const, features: [vehicle('trip-1')] };
    const routes = new Map([[routeJoinKey('bus', '999'), { name: '999', type: 'bus', route_color: 'FFFFFF' }]]);

    it('returns the fleet itself without a matching route or patch', () => {
        expect(enrichVehicleRouteMetadata(fleet, routes)).toBe(fleet);
        expect(enrichVehicleCollection(fleet, new Map(), new Map(), NOW)).toBe(fleet);
    });

    it('returns stop times and alerts themselves when they have nothing to resolve', () => {
        const stops = [{ type: 'Feature' as const, properties: { stop_name: 'A', stop_sequence: 1, stop_id: 'A', arrival_time: '12:00:00', departure_time: '12:00:00' } }];
        const alerts = [{ type: 'exclusion' as const, title: 'x', description: null, valid_from: null, valid_to: null, link: '' }];

        expect(enrichConnections(stops, new Map(), routes, new Map())).toBe(stops);
        expect(enrichAlertLineMetadata(alerts, new Map(), routes, new Map())).toBe(alerts);
    });
});
