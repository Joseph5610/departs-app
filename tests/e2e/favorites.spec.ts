import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';

test.describe('Favorites Tests', () => {
    test('should add a stop to favorites, view it in the favorites panel and open a departure\'s trip', async ({ page }) => {
        const mapPage = new MapPage(page);

        // Mock stops
        await page.route(/\/(api\/[^/]+\/stops|[^/]+\/map-stops\.json)(\?|$)/, async route => {
            await route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' },
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
            response => /\/[^/]+\/map-stops\.json(\?|$)/.test(response.url()) && response.status() === 200,
            { timeout: 30000 }
        );

        // Navigate to map and wait for load
        await mapPage.goto();
        await stopsResponsePromise;
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });

        // Go directly to the stop by URL parameter to skip search
        await page.goto('/prague/stop/U1111Z1P');
        
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
        await page.route('**/api/*/departures*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    departures: [
                        {
                            tripId: 'trip-1',
                            vehicleId: 'veh-1',
                            stopId: 'U1111Z1P',
                            line: 'C',
                            headsign: 'Letňany',
                            type: '1',
                            scheduled: new Date(Date.now() + 60000).toISOString(),
                            timestamp: new Date(Date.now() + 60000).toISOString(),
                            delay: 0,
                            route_color: 'C0115E'
                        }
                    ]
                })
            });
        });

        await page.route('**/api/*/vehicle-detail*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    trip_id: 'trip-1',
                    vehicle_id: 'veh-1',
                    route_short_name: 'C',
                    trip_headsign: 'Letňany',
                    type: '1',
                    route_color: 'C0115E',
                    stop_times: { features: [] }
                })
            });
        });

        // Open the favorites panel explicitly via the star button in MapControls
        await page.getByTestId('map-favorites-btn').click();

        // Favorites panel renders inside the same DetailPanel — same testid appears
        await expect(mapPage.detailPanel).toBeVisible({ timeout: 10000 });

        // The newly favorited stop should appear in the favorites list
        await expect(page.getByText('Hlavní nádraží').first()).toBeVisible();

        // A departure row opens its own trip
        await page.getByTestId('favorite-departure-trip-1').click();
        await expect(page).toHaveURL(/\/prague\/trip\/trip-1\/veh-1$/);
        await expect(page.getByTestId('vehicle-headsign')).toHaveText('Letňany', { timeout: 10000 });
    });

    test('should split pinned lines and stops into tabs and remember the chosen tab', async ({ page }) => {
        await page.addInitScript(() => {
            if (window.localStorage.getItem('departs-preferences')) return;
            window.localStorage.setItem('departs-preferences', JSON.stringify({
                state: {
                    hasSeenWelcome: true,
                    selectedCity: 'prague',
                    favoriteStops: ['U1111Z1P'],
                    favoriteLines: [{ city: 'prague', stopId: 'U1111Z1P', line: 'C', headsign: 'Letňany' }]
                },
                version: 0
            }));
        });

        await page.route(/\/(api\/[^/]+\/stops|[^/]+\/map-stops\.json)(\?|$)/, async route => {
            await route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' },
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [14.4332, 50.0831] },
                        properties: { stop_id: 'U1111Z1P', stop_name: 'Hlavní nádraží', platform_code: 'C', location_type: 0, parent_station: 'U1111', zone_id: 'P', is_train: 0, lines: [] }
                    }]
                })
            });
        });
        await page.route('**/api/*/departures*', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) });
        });

        await page.goto('/prague/favorites');

        const linesTab = page.getByTestId('favorites-tab-lines');
        const stopsTab = page.getByTestId('favorites-tab-stops');
        await expect(linesTab).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByText('Letňany')).toBeVisible();
        await expect(page.getByText('Hlavní nádraží', { exact: true })).not.toBeVisible();

        await stopsTab.click();
        await expect(page.getByText('Hlavní nádraží', { exact: true })).toBeVisible();
        await expect(page.getByText('Letňany')).not.toBeVisible();

        await page.reload();
        await expect(page.getByTestId('favorites-tab-stops')).toHaveAttribute('aria-selected', 'true');
    });

    test('should reorder pinned stops by dragging their handle', async ({ page }) => {
        await page.addInitScript(() => {
            if (window.localStorage.getItem('departs-preferences')) return;
            window.localStorage.setItem('departs-preferences', JSON.stringify({
                state: { hasSeenWelcome: true, selectedCity: 'prague', favoriteStops: ['S1', 'S2', 'S3'] },
                version: 0
            }));
        });

        const stop = (stop_id: string, stop_name: string) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [14.4332, 50.0831] },
            properties: { stop_id, stop_name, location_type: 0, parent_station: 'U1', zone_id: 'P', is_train: 0, lines: [] }
        });
        await page.route(/\/(api\/[^/]+\/stops|[^/]+\/map-stops\.json)(\?|$)/, async route => {
            await route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' },
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ type: 'FeatureCollection', features: [stop('S1', 'Alfa'), stop('S2', 'Beta'), stop('S3', 'Gama')] })
            });
        });
        await page.route('**/api/*/departures*', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) });
        });

        await page.goto('/prague/favorites');

        const handles = page.getByTestId('favorite-drag-handle');
        await expect(handles).toHaveCount(3);
        const from = (await handles.nth(2).boundingBox())!;
        const to = (await handles.nth(0).boundingBox())!;
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(from.x + from.width / 2, to.y - 10, { steps: 25 });
        await page.mouse.up();

        const titles = page.getByTestId('detail-panel').getByRole('button', { name: /^(Alfa|Beta|Gama)$/ });
        await expect(titles).toHaveText(['Gama', 'Alfa', 'Beta']);

        await page.reload();
        await expect(titles).toHaveText(['Gama', 'Alfa', 'Beta']);

        // The handle also moves its card with the arrow keys, keeping focus for the next press.
        await handles.nth(2).focus();
        await page.keyboard.press('ArrowUp');
        await expect(titles).toHaveText(['Gama', 'Beta', 'Alfa']);
        await page.keyboard.press('ArrowUp');
        await expect(titles).toHaveText(['Beta', 'Gama', 'Alfa']);
    });

    // The sheet's swipe must not take over a reorder drag started on the handle.
    test('should not move the mobile sheet while dragging a favourite by its handle', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const page = await context.newPage();
        await page.addInitScript(() => {
            window.localStorage.setItem('departs-preferences', JSON.stringify({
                state: { hasSeenWelcome: true, selectedCity: 'prague', favoriteStops: ['S1', 'S2'] },
                version: 0
            }));
        });

        const stop = (stop_id: string, stop_name: string) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [14.4332, 50.0831] },
            properties: { stop_id, stop_name, location_type: 0, parent_station: 'U1', zone_id: 'P', is_train: 0, lines: [] }
        });
        await page.route(/\/(api\/[^/]+\/stops|[^/]+\/map-stops\.json)(\?|$)/, async route => {
            await route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' },
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ type: 'FeatureCollection', features: [stop('S1', 'Alfa'), stop('S2', 'Beta')] })
            });
        });
        await page.route('**/api/*/departures*', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) });
        });

        await page.goto('/prague/favorites');
        const handle = page.getByTestId('favorite-drag-handle').first();
        await expect(handle).toBeVisible({ timeout: 30000 });
        const sheet = page.getByTestId('detail-panel');
        const sheetTop = async () => Math.round((await sheet.boundingBox())!.y);
        await expect.poll(sheetTop).toBeGreaterThan(0);
        const before = await sheetTop();

        const box = (await handle.boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 15; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + i * 12 }] });
        }
        expect(await sheetTop()).toBe(before);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

        await expect(page.getByTestId('detail-panel').getByRole('button', { name: /^(Alfa|Beta)$/ })).toHaveText(['Beta', 'Alfa']);
        expect(await sheetTop()).toBe(before);
        await context.close();
    });
});
