import { test, expect } from '@playwright/test';
import { mockStops } from '../fixtures/stops';
import { MapPage } from '../page-objects/MapPage';

test.describe('Routing Tests', () => {
    test('should open departure board when navigating directly to a /stop/:id path', async ({ page }) => {
        const mapPage = new MapPage(page);

        // Mock stops and departures
        await mockStops(page, {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [14.4332, 50.0831] },
                properties: { stop_id: 'U1111Z1P', stop_name: 'Hlavní nádraží', lines: [] }
            }]
        });

        await page.route('**/api/*/departures*', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) });
        });

        // Navigate directly to the new URL format
        await mapPage.goto('/prague/stop/U1111Z1P');
        
        await expect(mapPage.detailPanel).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Hlavní nádraží').first()).toBeVisible();
    });
});
