import { test, expect } from '@playwright/test';
import { FRONTEND_CITIES_CONFIG } from '../../src/config/cities';

interface StopProps { stop_id: string; is_centroid?: boolean; parent_station?: string | null; platform_code?: string | null }
interface StopFeature { properties: StopProps }

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

    test('should return stations with their Portabo platforms', async ({ request }) => {
        const res = await request.get('/api/duk/stops');
        expect(res.ok()).toBeTruthy();

        const { features } = await res.json() as { features: StopFeature[] };
        const station = features.find(f => f.properties.is_centroid);
        expect(station?.properties.stop_id).toMatch(/^centroid-\d+$/);

        const platforms = features.filter(f => f.properties.parent_station === station?.properties.stop_id);
        expect(platforms.length).toBeGreaterThan(0);
        for (const platform of platforms) {
            expect(platform.properties.stop_id).toMatch(/^\d+-\d+$/);
        }
    });

    test('should return departures for a station and only that platform for a platform', async ({ request }) => {
        const { features } = await (await request.get('/api/duk/stops')).json() as { features: StopFeature[] };
        const platform = features.find(f => !f.properties.is_centroid && f.properties.platform_code);
        expect(platform).toBeDefined();

        const stationRes = await request.get(`/api/duk/departures?stopId=${encodeURIComponent(platform!.properties.parent_station!)}`);
        expect(stationRes.ok()).toBeTruthy();
        expect(Array.isArray((await stationRes.json()).departures)).toBe(true);

        const platformRes = await request.get(`/api/duk/departures?stopId=${encodeURIComponent(platform!.properties.stop_id)}`);
        expect(platformRes.ok()).toBeTruthy();
        const { departures } = await platformRes.json() as { departures: Array<{ platform?: string; stopId: string }> };
        for (const dep of departures) {
            expect(dep.stopId).toBe(platform!.properties.stop_id);
            if (dep.platform) expect(dep.platform).toBe(platform!.properties.platform_code);
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
