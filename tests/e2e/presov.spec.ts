import { test, expect } from '@playwright/test';
import { FRONTEND_CITIES_CONFIG } from '../../src/config/cities';

/** Trojica. A fixed id: CI must not fetch data.departs.app itself, where Bot Fight Mode challenges runner IPs. */
const STATION_ID = 'centroid-trojica';

test.describe('Prešov Backend API tests', () => {
    test.skip(!FRONTEND_CITIES_CONFIG['presov'], 'Prešov city support is currently disabled in config');

    test('should be listed as a Slovak city without an alerts source', async ({ request }) => {
        const res = await request.get('/api/cities');
        expect(res.ok()).toBeTruthy();

        const { cities } = await res.json();
        const presov = cities.find((c: { slug: string }) => c.slug === 'presov');
        expect(presov).toBeDefined();
        expect(presov.country).toBe('SK');
        expect(presov.hasAlerts).toBeFalsy();
    });

    test('should return departures for a station', async ({ request }) => {
        const depsRes = await request.get(`/api/presov/departures?stopId=${STATION_ID}`);
        expect(depsRes.ok()).toBeTruthy();

        const depsData = await depsRes.json();
        expect(Array.isArray(depsData.departures)).toBe(true);
    });

    test('should return a vehicle collection', async ({ request }) => {
        const res = await request.get('/api/presov/vehicles');
        expect(res.ok()).toBeTruthy();

        const data = await res.json();
        expect(data.type).toBe('FeatureCollection');
        expect(Array.isArray(data.features)).toBe(true);
        // The collection may legitimately be empty overnight.
    });

    test('should return an empty alerts payload', async ({ request }) => {
        const res = await request.get('/api/presov/alerts');
        expect(res.ok()).toBeTruthy();

        const data = await res.json();
        expect(data.alerts).toEqual([]);
    });
});
