import { test, expect, type BrowserContext } from '@playwright/test';
import { mockStops } from '../fixtures/stops';

const HERE = { latitude: 50.0995, longitude: 14.4385 };

const stop = (stop_id: string, stop_name: string, northM: number, lines: Array<{ name: string; type: string; route_color: string }>) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [HERE.longitude, HERE.latitude + northM / 111_195] },
    properties: { stop_id, stop_name, location_type: 0, zone_id: 'P', lines },
});

const TRAM_17 = [{ name: '17', type: 'tram', route_color: '7A0603' }];

const openPhone = async (context: BrowserContext, favoriteStops: string[] = []) => {
    const page = await context.newPage();
    await page.addInitScript((favorites) => {
        window.localStorage.setItem('departs-preferences', JSON.stringify({
            state: { hasSeenWelcome: true, selectedCity: 'prague', favoriteStops: favorites },
            version: 0
        }));
    }, favoriteStops);
    await mockStops(page, {
        type: 'FeatureCollection',
        features: [
            stop('S1', 'Vltavská', 40, TRAM_17),
            stop('S2', 'Tusarova', 300, TRAM_17),
            { ...stop('E1', 'E1', 5, []), properties: { stop_id: 'E1', stop_name: 'E1', location_type: 2 } },
        ]
    });
    await page.route('**/api/*/departures*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) }));
    await page.goto('/prague');
    return page;
};

test.describe('Mobile home sheet', () => {
    test('peeks with the search field and the map controls, and gives way to a stop board', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const page = await openPhone(context, ['S2']);

        const sheet = page.getByTestId('home-sheet');
        await expect(sheet).toBeVisible({ timeout: 30000 });
        await expect(sheet.getByTestId('search-trigger')).toBeVisible();
        await expect(page.getByTestId('search-overlay')).toHaveCSS('opacity', '0');
        await expect(sheet.getByTestId('map-locate-btn')).toBeVisible();

        await page.getByTestId('home-sheet-grabber').click();
        await expect(sheet.getByRole('heading', { name: 'Favorites' })).toBeInViewport();

        await sheet.getByRole('button', { name: 'Tusarova' }).click();
        await expect(page.getByTestId('detail-panel')).toBeVisible();
        await expect(page).toHaveURL(/\/prague\/stop\/S2/);
        await expect(sheet).toBeHidden();
        await context.close();
    });

    // The field sits at the top so the iOS keyboard never has to scroll the sheet to reveal it.
    test('searches in a full-screen layer with the field at the top', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const page = await openPhone(context);

        await page.getByTestId('search-trigger').click({ timeout: 30000 });
        const overlay = page.getByTestId('search-overlay');
        const input = overlay.getByTestId('search-input');
        await expect(overlay).toHaveCSS('opacity', '1');
        await expect(input).toBeFocused();
        expect((await input.boundingBox())!.y).toBeLessThan(100);

        await input.fill('Tusar');
        await page.locator('[data-testid="search-item-res-stop-S2"]').click();
        await expect(page).toHaveURL(/\/prague\/stop\/S2/);
        await expect(page.getByTestId('search-overlay')).toHaveCount(0);
        await context.close();
    });

    // A line filter shows on the map, so the sheet gets out of the way and the search button carries the filter.
    test('drops the sheet to its peek after a line filter and clears it from the search button', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const page = await openPhone(context);
        const sheet = page.getByTestId('home-sheet');
        await expect(sheet).toBeVisible({ timeout: 30000 });
        const peekTop = Math.round((await sheet.boundingBox())!.y);

        await page.getByTestId('home-sheet-grabber').click();
        await expect.poll(async () => Math.round((await sheet.boundingBox())!.y)).toBeLessThan(peekTop);

        await page.getByTestId('search-trigger').click();
        await page.getByTestId('search-input').fill('17');
        await page.getByTestId('search-input').press('Enter');

        await expect(page.getByTestId('search-overlay')).toHaveCSS('opacity', '0');
        await expect.poll(async () => Math.round((await sheet.boundingBox())!.y)).toBe(peekTop);
        await expect(page.getByTestId('search-trigger')).toContainText('17');

        await page.getByTestId('search-clear-selection').click();
        await expect(page.getByTestId('search-clear-selection')).toHaveCount(0);
        await context.close();
    });

    // Entrances share the station's spot but open no board, so only served stops are listed.
    test('lists the served stops nearest the user', async ({ browser }) => {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
            geolocation: HERE, permissions: ['geolocation'],
        });
        const page = await openPhone(context);

        await expect(page.getByTestId('home-sheet')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('home-sheet-grabber').click();

        const rows = page.locator('[data-testid^="nearby-stop-"]');
        await expect(rows).toHaveCount(2);
        await expect(rows.first()).toHaveAttribute('data-testid', 'nearby-stop-S1');
        await context.close();
    });

    // A card lifts the sheet only while it is open; closing it gives the home back the height it had.
    test('returns to the peek after a stop opened from it is nudged and closed', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const page = await openPhone(context);
        const sheet = page.getByTestId('home-sheet');
        await expect(sheet).toBeVisible({ timeout: 30000 });
        const peekTop = Math.round((await sheet.boundingBox())!.y);

        await page.getByTestId('search-trigger').click();
        await page.getByTestId('search-input').fill('Tusar');
        await page.locator('[data-testid="search-item-res-stop-S2"]').click();
        const panel = page.getByTestId('detail-panel');
        await expect(panel).toBeVisible();
        await expect.poll(async () => Math.round((await panel.boundingBox())!.y)).toBeLessThan(peekTop);

        // A drag released back on the same height is reported as a snap change, like a sloppy tap.
        const grabber = (await page.getByTestId('home-sheet-grabber').boundingBox())!;
        await page.mouse.move(grabber.x + grabber.width / 2, grabber.y + grabber.height / 2);
        await page.mouse.down();
        await page.mouse.move(grabber.x + grabber.width / 2, grabber.y + grabber.height / 2 + 30, { steps: 5 });
        await page.mouse.up();

        await page.getByTestId('detail-panel-close').click();
        await expect.poll(async () => Math.round((await sheet.boundingBox())!.y)).toBe(peekTop);
        await context.close();
    });
});
