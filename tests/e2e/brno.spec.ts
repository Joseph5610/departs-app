import { test, expect } from '@playwright/test';
import { FRONTEND_CITIES_CONFIG } from '../../src/config/cities';

test.describe('Brno Backend API tests', () => {
    test.skip(!FRONTEND_CITIES_CONFIG['brno'], 'Brno city support is currently disabled in config');

    // We are testing the API directly against the local wrangler dev server 
    // to ensure the newly refactored GTFS adapter services work and return 
    // valid JSON under Cloudflare limits without UI flakiness.

    test('should return valid GeoJSON for stops', async ({ request }) => {
        const res = await request.get('/api/brno/stops');
        expect(res.ok()).toBeTruthy();
        
        const data = await res.json();
        expect(data.type).toBe('FeatureCollection');
        expect(Array.isArray(data.features)).toBe(true);
        expect(data.features.length).toBeGreaterThan(0);
        
        const hasCentroid = data.features.some((f: { properties?: { is_centroid?: boolean } }) => f.properties?.is_centroid === true);
        expect(hasCentroid).toBe(true);
    });

    test('should return departures for a valid stop', async ({ request }) => {
        // First get a stop
        const stopsRes = await request.get('/api/brno/stops');
        const stopsData = await stopsRes.json();
        
        const centroid = stopsData.features.find((f: { properties?: { is_centroid?: boolean } }) => f.properties?.is_centroid === true);
        expect(centroid).toBeDefined();
        
        const stopId = centroid.properties.stop_id;
        
        // Fetch departures
        const depsRes = await request.get(`/api/brno/departures?stopId=${encodeURIComponent(stopId)}`);
        expect(depsRes.ok()).toBeTruthy();
        
        const depsData = await depsRes.json();
        expect(Array.isArray(depsData.departures)).toBe(true);
        // It might be empty if no departures currently, but we shouldn't fail the test
    });

    test('should return alerts payload', async ({ request }) => {
        const res = await request.get('/api/brno/alerts');
        expect(res.ok()).toBeTruthy();
        
        const data = await res.json();
        expect(Array.isArray(data.alerts)).toBe(true);
    });

    test('should return empty infotexts payload', async ({ request }) => {
        const res = await request.get('/api/brno/infotexts');
        expect(res.ok()).toBeTruthy();
        
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
    });
});
