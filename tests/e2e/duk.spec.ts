import { test, expect } from '@playwright/test';
import { FRONTEND_CITIES_CONFIG } from '../../src/config/cities';

/** Ústí n.L., Divadlo and its platform 1. Fixed ids: CI must not fetch data.departs.app itself, where Bot Fight Mode challenges runner IPs. */
const STATION_ID = 'centroid-1734';
const PLATFORM_ID = '1734-1';
const PLATFORM_CODE = '1';

test.describe('Ústecký kraj (DÚK) Backend API tests', () => {
    test.skip(!FRONTEND_CITIES_CONFIG['duk'], 'DÚK support is currently disabled in config');

    test('should be listed as a Czech city without an alerts source', async ({ request }) => {
        const res = await request.get('/api/cities');
        expect(res.ok()).toBeTruthy();

        const { cities } = await res.json();
        const duk = cities.find((c: { slug: string }) => c.slug === 'duk');
        expect(duk).toBeDefined();
        expect(duk.country).toBe('CZ');
        expect(duk.hasAlerts).toBeFalsy();
    });

    test('should return departures for a station and only that platform for a platform', async ({ request }) => {
        const stationRes = await request.get(`/api/duk/departures?stopId=${STATION_ID}`);
        expect(stationRes.ok()).toBeTruthy();
        expect(Array.isArray((await stationRes.json()).departures)).toBe(true);

        const platformRes = await request.get(`/api/duk/departures?stopId=${PLATFORM_ID}`);
        expect(platformRes.ok()).toBeTruthy();
        const { departures } = await platformRes.json() as { departures: Array<{ platform?: string; stopId: string }> };
        for (const dep of departures) {
            expect(dep.stopId).toBe(PLATFORM_ID);
            if (dep.platform) expect(dep.platform).toBe(PLATFORM_CODE);
        }
    });

    test('should return a vehicle collection', async ({ request }) => {
        const res = await request.get('/api/duk/vehicles');
        expect(res.ok()).toBeTruthy();

        const data = await res.json();
        expect(data.type).toBe('FeatureCollection');
        expect(Array.isArray(data.features)).toBe(true);
        // The collection may legitimately be empty overnight.
    });

    test('should return an empty alerts payload', async ({ request }) => {
        const res = await request.get('/api/duk/alerts');
        expect(res.ok()).toBeTruthy();
        expect((await res.json()).alerts).toEqual([]);
    });
});
