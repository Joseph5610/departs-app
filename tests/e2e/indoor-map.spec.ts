import { test, expect } from '@playwright/test';
import { hlavniNadrazi, mockStops } from '../fixtures/stops';
import { mockIndoor, openMapAt } from '../fixtures/indoor';
import { MapPage } from '../page-objects/MapPage';

test.describe('Station floor plans', () => {
    test.beforeEach(async ({ page }) => {
        await mockStops(page, hlavniNadrazi());
        await mockIndoor(page);
    });

    test('shows a floor switcher over a station plan and steps between its floors', async ({ page }) => {
        const mapPage = new MapPage(page);
        await openMapAt(page, 17);
        await mapPage.goto('/prague');

        await expect(mapPage.floorLevel).toHaveText('0', { timeout: 20000 });
        await expect(mapPage.floorUp).toBeDisabled();
        await mapPage.floorDown.click();
        await expect(mapPage.floorLevel).toHaveText('-1');
        await expect(mapPage.floorDown).toBeDisabled();
    });

    test('keeps the picked floor while the map moves within the station', async ({ page }) => {
        const mapPage = new MapPage(page);
        await openMapAt(page, 17);
        await mapPage.goto('/prague');

        await expect(mapPage.floorLevel).toHaveText('0', { timeout: 20000 });
        await mapPage.floorDown.click();
        await expect(mapPage.floorLevel).toHaveText('-1');

        const box = (await page.locator('.maplibregl-canvas').boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
        await expect(mapPage.floorLevel).toHaveText('-1');
    });

    // A station without a street-level floor opens on the floor nearest it.
    test('opens a station without street level on the floor nearest it', async ({ page }) => {
        const mapPage = new MapPage(page);
        await mockIndoor(page, [-5, -3]);
        await openMapAt(page, 17);
        await mapPage.goto('/prague');

        await expect(mapPage.floorLevel).toHaveText('-3', { timeout: 20000 });
    });

    // A single floor leaves nothing to switch between.
    test('shows no floor switcher for a single-floor plan', async ({ page }) => {
        const mapPage = new MapPage(page);
        await mockIndoor(page, [0]);
        await openMapAt(page, 17);
        await mapPage.goto('/prague');

        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);
        await expect(mapPage.floorLevel).toHaveCount(0);
    });

    test('hides the floor switcher when zoomed out', async ({ page }) => {
        const mapPage = new MapPage(page);
        await openMapAt(page, 14);
        await mapPage.goto('/prague');

        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });
        await expect(mapPage.floorLevel).toHaveCount(0);
    });
});
