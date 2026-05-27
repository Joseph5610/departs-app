import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';

test.describe('Favorites Tests', () => {
    test('should add a stop to favorites and view it in the favorites panel', async ({ page }) => {
        const mapPage = new MapPage(page);

        // Mock stops
        await page.route('**/api/stops*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [14.4332, 50.0831] },
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

        const stopsResponsePromise = page.waitForResponse(
            response => response.url().includes('/api/stops') && response.status() === 200,
            { timeout: 30000 }
        );

        // Navigate to map and wait for load
        await mapPage.goto();
        await stopsResponsePromise;
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });

        // Go directly to the stop by URL parameter to skip search
        await page.goto('/?stopId=U1111Z1P');
        
        await expect(mapPage.detailPanel).toBeVisible();

        // Ensure we are viewing the departure board
        await expect(page.getByText('Hlavní nádraží').first()).toBeVisible();

        // Click the favorites toggle button to add this stop
        const favoriteBtn = page.getByTestId('favorite-btn');
        await expect(favoriteBtn).toBeVisible();
        await favoriteBtn.click();

        // Close the stop detail panel
        await mapPage.closeDetailPanel();
        await expect(mapPage.detailPanel).not.toBeVisible({ timeout: 10000 });

        // Mock departures for the favorites panel bulk fetch
        await page.route('**/api/departures*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ departures: [] })
            });
        });

        // Open the favorites panel explicitly via the star button in MapControls
        await page.getByTestId('map-favorites-btn').click();

        // Favorites panel renders inside the same DetailPanel — same testid appears
        await expect(mapPage.detailPanel).toBeVisible({ timeout: 10000 });

        // The newly favorited stop should appear in the favorites list
        await expect(page.getByText('Hlavní nádraží').first()).toBeVisible();
    });
});
