import { test, expect } from '@playwright/test';
import { hlavniNadrazi, mockStops, STOPS_FILE_URL } from '../fixtures/stops';
import { MapPage } from '../page-objects/MapPage';
import { SearchPage } from '../page-objects/SearchPage';

test.describe('Departure Board Tests', () => {
    // A trip's row holds its time and notes, so it must grow with them instead of taking a button's height.
    test('keeps an expanded later departure as tall as its content', async ({ page }) => {
        const mapPage = new MapPage(page);
        await mockStops(page, hlavniNadrazi());
        const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
        const departures = Array.from({ length: 8 }, (_, i) => ({ tripId: `trip-${i}`, line: '9', headsign: 'Spojovací', type: '0', scheduled: at(i * 8 + 2), timestamp: at(i * 8 + 2), delay: 0, continues_as: { line: '10', headsign: 'Vozovna Motol' } }));
        await page.route('**/api/*/departures*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures }) }));
        await mapPage.goto('/prague/stop/U1111Z1P');

        await page.getByRole('button', { name: /more connections/i }).first().click();
        const row = page.locator('[data-testid^="departure-item-trip-"]').last();
        await expect(row).toBeVisible({ timeout: 15000 });
        const box = (await row.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
    });

    test('gives the phone board\'s small controls 44px touch targets', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const page = await context.newPage();
        await page.addInitScript(() => {
            window.localStorage.setItem('departs-preferences', JSON.stringify({ state: { hasSeenWelcome: true, selectedCity: 'prague' }, version: 0 }));
        });
        await mockStops(page, hlavniNadrazi());
        await page.route('**/api/*/departures*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) }));
        await page.goto('/prague/stop/U1111Z1P');

        const hitHeight = (testId: string) => page.getByTestId(testId).evaluate(el => getComputedStyle(el, '::before').height);
        await expect(page.getByTestId('detail-panel-close')).toBeVisible({ timeout: 30000 });
        expect(await hitHeight('detail-panel-close')).toBe('44px');
        expect(await hitHeight('board-walk')).toBe('44px');
        await context.close();
    });

    test('should load departures and allow expanding connections', async ({ page }) => {
        const mapPage = new MapPage(page);
        const searchPage = new SearchPage(page);

        await mockStops(page, hlavniNadrazi());

        // Mock departures
        await page.route('**/api/*/departures*', async route => {
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
            response => STOPS_FILE_URL.test(response.url()) && response.status() === 200,
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
