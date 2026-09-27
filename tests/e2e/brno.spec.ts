import { test, expect } from '@playwright/test';
import { FRONTEND_CITIES_CONFIG } from '../../src/config/cities';

/** Hlavní nádraží. A fixed id: CI must not fetch data.departs.app itself, where Bot Fight Mode challenges runner IPs. */
const STATION_ID = 'U1146N170';

test.describe('Brno Backend API tests', () => {
    test.skip(!FRONTEND_CITIES_CONFIG['brno'], 'Brno city support is currently disabled in config');

    // We are testing the API directly against the local wrangler dev server 
    // to ensure the newly refactored GTFS adapter services work and return 
    // valid JSON under Cloudflare limits without UI flakiness.

    test('should return departures for a valid stop', async ({ request }) => {
        const depsRes = await request.get(`/api/brno/departures?stopId=${STATION_ID}`);
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
