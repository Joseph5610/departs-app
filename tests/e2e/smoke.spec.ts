import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';
import { SearchPage } from '../page-objects/SearchPage';

test.describe('Smoke tests', () => {
    test('should load the map and search for a stop', async ({ page }) => {
        const mapPage = new MapPage(page);
        const searchPage = new SearchPage(page);

        // Mock the massive /api/stops endpoint with a lightweight mock payload to prevent overloading the dev server in parallel CI test runs
        await page.route('**/api/*/stops*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [14.4332, 50.0831]
                            },
                            properties: {
                                stop_id: 'U1111Z1P',
                                stop_name: 'Hlavní nádraží',
                                platform_code: 'C',
                                location_type: 0,
                                parent_station: 'U1111',
                                zone_id: 'P',
                                is_train: 0,
                                metro_lines: [{ name: 'C', route_color: 'C0115E' }],
                                lines: [{ name: 'C', type: 'metro', route_color: 'C0115E' }]
                            }
                        }
                    ]
                })
            });
        });

        // Wait for the stops API response to finish loading so the stop search index is fully built
        const stopsResponsePromise = page.waitForResponse(
            response => response.url().match(/\/api\/.*\/stops/) !== null && response.status() === 200,
            { timeout: 30000 }
        );

        await mapPage.goto();
        await stopsResponsePromise;
        
        // Verify map controls are visible (indicates map loaded)
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });

        // Search for a known stop (example: 'Hlavní nádraží')
        await searchPage.search("Hlavn\u00ed n\u00e1dra\u017e\u00ed");
        
        // Look for the stop in results (using the Page Object)
        const stopNameRegex = new RegExp("Hlavn\u00ed\\sn\u00e1dra\u017e\u00ed");
        const stopItem = searchPage.getStopSearchItem(stopNameRegex);
        await expect(stopItem).toBeVisible({ timeout: 15000 });
        
        // Click the stop using the Page Object action
        await searchPage.selectStopByRegex(stopNameRegex);
        
        // Verify detail panel opens
        await expect(mapPage.detailPanel).toBeVisible();
    });
});
