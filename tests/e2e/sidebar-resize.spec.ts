import { test, expect, type Page } from '@playwright/test';
import { hlavniNadrazi, mockStops } from '../fixtures/stops';
import { MapPage } from '../page-objects/MapPage';

const VIEWPORT = { width: 1440, height: 900 };
const SIDEBAR_INSET = 20;

const openStop = async (page: Page) => {
    const mapPage = new MapPage(page);
    await mockStops(page, hlavniNadrazi({}));
    await page.route('**/api/*/departures*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) }));
    await mapPage.goto('/prague/stop/U1111Z1P');
    await expect(mapPage.detailPanel).toBeVisible({ timeout: 15000 });
    return mapPage;
};

const width = async (page: Page) => (await page.getByTestId('detail-panel').boundingBox())!.width;

const storedWidth = (page: Page) =>
    page.evaluate(() => JSON.parse(localStorage.getItem('departs-preferences') ?? '{}').state?.sidebarWidthPx);

test.describe('Desktop panel resizing', () => {
    test.use({ viewport: VIEWPORT });

    test('dragging the edge widens the panel, keeps the search centred beside it and remembers the width', async ({ page }) => {
        await openStop(page);
        const handle = page.getByTestId('sidebar-resize-handle');
        const before = await width(page);
        const box = (await handle.boundingBox())!;

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 300, box.y + box.height / 2, { steps: 8 });
        await page.mouse.up();

        await expect.poll(() => width(page)).toBeGreaterThan(before + 250);
        const after = await width(page);
        await expect.poll(() => storedWidth(page)).toBe(Math.round(after));

        const visibleCentre = (SIDEBAR_INSET + after + VIEWPORT.width) / 2;
        await expect.poll(async () => {
            const search = (await page.getByTestId('search-container').boundingBox())!;
            return Math.round(search.x + search.width / 2);
        }).toBeCloseTo(visibleCentre, -1);

        await handle.dblclick();
        await expect.poll(() => storedWidth(page)).toBe(0);
        await expect.poll(() => width(page)).toBeCloseTo(before, 0);
    });

    test('arrow keys resize the panel within the viewport share', async ({ page }) => {
        await openStop(page);
        const handle = page.getByTestId('sidebar-resize-handle');
        const before = await width(page);

        await handle.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => width(page)).toBeGreaterThan(before);

        for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
        await expect.poll(() => width(page)).toBe(VIEWPORT.width * 0.6);
        await expect(handle).toHaveAttribute('aria-valuenow', String(VIEWPORT.width * 0.6));
    });
});
