import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';

test.describe('Vehicle Detail & Timeline Tests', () => {
    test('should load vehicle details and stop timeline from departure board', async ({ page }) => {
        const mapPage = new MapPage(page);

        // Mock stops and departures
        await page.route('**/api/*/stops*', async route => {
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

        await page.route('**/api/*/departures*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    departures: [
                        {
                            tripId: 'trip-1',
                            vehicleId: 'veh-1',
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

        // Mock vehicle detail
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
                    is_wheelchair_accessible: true,
                    is_air_conditioned: true,
                    stop_times: {
                        features: [
                            {
                                type: 'Feature',
                                geometry: { type: 'Point', coordinates: [14.4332, 50.0831] },
                                properties: {
                                    stop_id: 'U1111Z1P',
                                    stop_name: 'Hlavní nádraží',
                                    stop_sequence: 1,
                                    arrival_time: new Date(Date.now() + 60000).toISOString(),
                                    departure_time: new Date(Date.now() + 120000).toISOString()
                                }
                            },
                            {
                                type: 'Feature',
                                geometry: { type: 'Point', coordinates: [14.4342, 50.0911] },
                                properties: {
                                    stop_id: 'U2222',
                                    stop_name: 'Florenc',
                                    stop_sequence: 2,
                                    arrival_time: new Date(Date.now() + 180000).toISOString(),
                                    departure_time: new Date(Date.now() + 240000).toISOString()
                                }
                            }
                        ]
                    }
                })
            });
        });

        // Wait for the stops API response
        const stopsResponsePromise = page.waitForResponse(
            response => response.url().match(/\/api\/.*\/stops/) !== null && response.status() === 200,
            { timeout: 30000 }
        );

        // Go directly to the stop by URL parameter to skip search
        await page.goto('/prague/stop/U1111Z1P');
        
        await stopsResponsePromise;
        await expect(mapPage.detailPanel).toBeVisible();

        // Check if group is visible (Line C, Letňany)
        const departureItem = page.getByTestId('departure-item-trip-1');
        await expect(departureItem).toBeVisible();

        // Click departure item to open vehicle detail
        const vehicleDetailResponsePromise = page.waitForResponse(
            response => response.url().match(/\/api\/.*\/vehicle-detail/) !== null && response.status() === 200,
            { timeout: 15000 }
        );
        await departureItem.click();
        await vehicleDetailResponsePromise;

        // Check if Vehicle Detail is open (look for the line badge C and destination Letňany)
        await expect(page.getByTestId('vehicle-headsign')).toHaveText('Letňany', { timeout: 10000 });

        // StopTimeline should render the stops (scoped to panel to avoid alert duplicates)
        await expect(mapPage.detailPanel.getByText('Florenc', { exact: true })).toBeVisible();
    });
});
