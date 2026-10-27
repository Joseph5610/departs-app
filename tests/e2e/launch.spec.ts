import { test, expect, type Browser, type Page } from '@playwright/test';

const BRNO = { latitude: 49.1951, longitude: 16.6068 };
const CELL = 0.01;

/** A coverage file with stops in the one cell holding `point`, so the app knows which city that is. */
const coverageAt = ({ latitude, longitude }: { latitude: number; longitude: number }) => ({
    cell: CELL,
    cells: { [`${Math.floor(longitude / CELL)}|${Math.floor(latitude / CELL)}`]: 50 },
});

const open = async (browser: Browser, path: string, { located = true }: { located?: boolean } = {}): Promise<Page> => {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        ...(located ? { geolocation: BRNO, permissions: ['geolocation'] } : {}),
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
        window.localStorage.setItem('departs-preferences', JSON.stringify({ state: { hasSeenWelcome: true, selectedCity: 'prague' }, version: 0 }));
    });
    await page.route(/\/(prague|brno)\/coverage\.json$/, route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(route.request().url().includes('/brno/') ? coverageAt(BRNO) : coverageAt({ latitude: 50.0875, longitude: 14.4212 })),
    }));
    await page.route('**/api/*/departures*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) }));
    await page.goto(path);
    return page;
};

// Opening the app while travelling lands on the rider's city, not the one they last used.
test.describe('Launch', () => {
    test('switches to the city the user is in when location is allowed', async ({ browser }) => {
        const page = await open(browser, '/');
        await expect(page).toHaveURL(/\/brno$/, { timeout: 30000 });
    });

    test('keeps a linked stop in its own city', async ({ browser }) => {
        const page = await open(browser, '/prague/stop/U115Z1P');
        await page.waitForTimeout(5000);
        await expect(page).toHaveURL(/\/prague\/stop\/U115Z1P$/);
    });

    test('opens the selected city without a location, and keeps the camera out of the URL', async ({ browser }) => {
        const page = await open(browser, '/prague', { located: false });
        await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
        const box = (await page.locator('canvas').first().boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(800);
        expect(page.url()).not.toMatch(/[?&](lat|lng|z)=/);
    });
});
