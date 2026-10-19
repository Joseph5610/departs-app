import { test, expect } from '@playwright/test';
import { hlavniNadrazi, mockStops } from '../fixtures/stops';
import { MapPage } from '../page-objects/MapPage';

test.describe('Routing Tests', () => {
    test('should open departure board when navigating directly to a /stop/:id path', async ({ page }) => {
        const mapPage = new MapPage(page);

        // Mock stops and departures
        await mockStops(page, hlavniNadrazi({}));

        await page.route('**/api/*/departures*', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) });
        });

        // Navigate directly to the new URL format
        await mapPage.goto('/prague/stop/U1111Z1P');
        
        await expect(mapPage.detailPanel).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Hlavní nádraží').first()).toBeVisible();
    });

    // Links saved before stops.json name a PID station by its platforms and a merged platform by both its ids.
    const andel = {
        stations: [{ id: 'U1040-1', name: 'Anděl', pos: [14.4037, 50.071] as [number, number] }],
        platforms: [
            { id: 'U1040Z1', aliases: ['U1040Z1P'], station: 'U1040-1', pos: [14.4036, 50.0719] as [number, number], code: 'A', routes: [] },
            { id: 'U1040Z2P', station: 'U1040-1', pos: [14.4038, 50.0718] as [number, number], code: 'B', routes: [] },
        ],
    };

    test('opens a stop linked by an older id under its own id, asking for every id of its platforms', async ({ page }) => {
        await mockStops(page, andel);
        const requested: string[] = [];
        await page.route('**/api/*/departures*', async route => {
            requested.push(new URL(route.request().url()).searchParams.get('stopId') ?? '');
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) });
        });

        await page.goto('/prague/stop/U1040Z1P%2CU1040Z1%2CU1040Z2P');
        await expect(page).toHaveURL(/\/prague\/stop\/U1040-1$/, { timeout: 15000 });
        await expect.poll(() => requested).toContain('U1040Z1,U1040Z1P,U1040Z2P');

        await page.goto('/prague/stop/U1040Z1%2CU1040Z1P');
        await expect(page).toHaveURL(/\/prague\/stop\/U1040Z1$/, { timeout: 15000 });
    });

    // A stop pinned under an alias is the same stop: it shows as pinned, and unpinning drops the alias.
    test('shows a stop pinned under an alias as pinned', async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('departs-preferences', JSON.stringify({
                state: { hasSeenWelcome: true, selectedCity: 'prague', favoriteStops: ['U1040Z1P'] },
                version: 0,
            }));
        });
        await mockStops(page, andel);
        await page.route('**/api/*/departures*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) }));

        await page.goto('/prague/stop/U1040Z1');
        const star = page.getByTestId('favorite-btn').first();
        await expect(star).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 });
        await star.click();
        await expect(star).toHaveAttribute('aria-pressed', 'false');
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('departs-preferences') ?? '{}').state?.favoriteStops)).toEqual([]);
    });
});
