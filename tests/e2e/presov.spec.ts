import { test, expect } from '@playwright/test';
import { FRONTEND_CITIES_CONFIG } from '../../src/config/cities';

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

    test('should return stops with synthetic centroids', async ({ request }) => {
        const res = await request.get('/api/presov/stops');
        expect(res.ok()).toBeTruthy();

        const data = await res.json();
        expect(data.type).toBe('FeatureCollection');
        expect(data.features.length).toBeGreaterThan(0);

        const centroid = data.features.find((f: { properties?: { is_centroid?: boolean } }) => f.properties?.is_centroid === true);
        expect(centroid).toBeDefined();
        expect(centroid.properties.stop_id).toMatch(/^centroid-/);
    });

    test('should return departures for a station', async ({ request }) => {
        const stopsRes = await request.get('/api/presov/stops');
        const stopsData = await stopsRes.json();
        const centroid = stopsData.features.find((f: { properties?: { is_centroid?: boolean } }) => f.properties?.is_centroid === true);

        const depsRes = await request.get(`/api/presov/departures?stopId=${encodeURIComponent(centroid.properties.stop_id)}`);
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
