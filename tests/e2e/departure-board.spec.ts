import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';
import { SearchPage } from '../page-objects/SearchPage';

test.describe('Departure Board Tests', () => {
    test('should load departures and allow expanding connections', async ({ page }) => {
        const mapPage = new MapPage(page);
        const searchPage = new SearchPage(page);

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

        // Mock departures
        await page.route('**/api/departures*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    departures: [
                        {
                            tripId: 'trip-1',
                            line: 'C',
                            headsign: 'Letňany',
                            type: '1',
                            scheduled: new Date(Date.now() + 60000).toISOString(), // 1 min from now
                            timestamp: new Date(Date.now() + 60000).toISOString(),
                            delay: 0
                        },
                        {
                            tripId: 'trip-2',
                            line: 'C',
                            headsign: 'Letňany',
                            type: '1',
                            scheduled: new Date(Date.now() + 300000).toISOString(), // 5 min
                            timestamp: new Date(Date.now() + 300000 + 60000).toISOString(),
                            delay: 60
                        },
                        {
                            tripId: 'trip-3',
                            line: 'C',
                            headsign: 'Letňany',
                            type: '1',
                            scheduled: new Date(Date.now() + 600000).toISOString(), // 10 min
                            timestamp: new Date(Date.now() + 600000).toISOString(),
                            delay: 0
                        },
                        {
                            tripId: 'trip-4',
                            line: 'C',
                            headsign: 'Letňany',
                            type: '1',
                            scheduled: new Date(Date.now() + 900000).toISOString(), // 15 min
                            timestamp: new Date(Date.now() + 900000).toISOString(),
                            delay: 0
                        },
                        {
                            tripId: 'trip-5',
                            line: 'C',
                            headsign: 'Letňany',
                            type: '1',
                            scheduled: new Date(Date.now() + 1200000).toISOString(), // 20 min
                            timestamp: new Date(Date.now() + 1200000).toISOString(),
                            delay: 0
                        }
                    ]
                })
            });
        });

        // Wait for the stops API response to finish loading so the stop search index is fully built
        const stopsResponsePromise = page.waitForResponse(
            response => response.url().includes('/api/stops') && response.status() === 200,
            { timeout: 30000 }
        );

        await mapPage.goto();
        await stopsResponsePromise;
        
        // Wait for controls to verify map loaded
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });

        // Search for stop and select it
        await searchPage.search("Hlavní nádraží");
        const stopNameRegex = new RegExp("Hlavní\\snádraží");
        const stopItem = searchPage.getStopSearchItem(stopNameRegex);
        await expect(stopItem).toBeVisible({ timeout: 15000 });
        await searchPage.selectStopByRegex(stopNameRegex);
        
        // Detail panel should open
        await expect(mapPage.detailPanel).toBeVisible();

        // Check if group is visible (Line C, Letňany)
        await expect(page.getByText('Letňany').first()).toBeVisible();

        // 4 departures, default visible is 3, so expand button should exist
        const moreBtn = page.getByRole('button', { name: /more connections|další spoje/i });
        await expect(moreBtn).toBeVisible();

        // Click expand
        await moreBtn.click();

        // Expand button should now say 'show less' / 'méně'
        const lessBtn = page.getByRole('button', { name: /show less|méně/i });
        await expect(lessBtn).toBeVisible();
    });
});
