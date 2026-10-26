import { test, expect, type Page } from '@playwright/test';
import { hlavniNadrazi, mockStops } from '../fixtures/stops';

const MIN = 60_000;

/** A timetable time (`HH:MM:SS`) `offsetMs` from now in Prague, as the trip detail gives it. */
const pragueTime = (offsetMs: number) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
        .format(Date.now() + offsetMs);

const stop = (sequence: number, id: string, name: string, offsetMs: number) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [14.4332 + sequence / 1000, 50.0831] },
    properties: { stop_id: id, stop_name: name, stop_sequence: sequence, arrival_time: pragueTime(offsetMs), departure_time: pragueTime(offsetMs) },
});

/** A trip leaving Hlavní nádraží in 20 min with two stops after it; `running`: its vehicle has left the first stop. */
async function mockTrip(page: Page, { running = false } = {}) {
    await mockStops(page, hlavniNadrazi());
    await page.route('**/api/*/departures*', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            departures: [{
                tripId: 'trip-1', vehicleId: 'veh-1', line: 'C', headsign: 'Letňany', type: 'metro', stopId: 'U1111Z1P',
                scheduled: new Date(Date.now() + 20 * MIN).toISOString(), timestamp: new Date(Date.now() + 20 * MIN).toISOString(),
                delay: 0, isCanceled: false, directionId: '0',
            }],
        }),
    }));
    await page.route('**/api/*/vehicle-detail*', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            gtfs_trip_id: new URL(route.request().url()).searchParams.get('tripId') ?? 'trip-1', vehicle_id: 'veh-1', route_short_name: 'C', trip_headsign: 'Letňany', route_type: 'metro',
            route_color: 'C0115E', delay: 0, is_static_fallback: !running, state_position: running ? 'on_track' : 'unknown', last_stop_sequence: running ? 1 : null,
            stop_times: { features: [stop(1, 'U1111Z1P', 'Hlavní nádraží', 20 * MIN), stop(2, 'U2222', 'Florenc', 25 * MIN), stop(3, 'U3333', 'Vysočanská', 30 * MIN)] },
        }),
    }));
}

/** A saved trip on `tripId`, boarding at Hlavní nádraží in 20 min and getting off at Florenc, as the app stores it. */
const savedTrip = (tripId: string, city = 'prague') => ({
    city, tripId, vehicleId: 'veh-1', exitSequence: 2, exitStopName: 'Florenc', toEnd: false, startedAt: Date.now(), revision: 1,
    board: { sequence: 1, stopId: 'U1111Z1P', stopName: 'Hlavní nádraží', scheduledMs: Date.now() + 20 * MIN, leadMin: 5 },
});

/** Stores trips before the app loads, as if saved in an earlier visit. */
const seedTrips = (page: Page, trips: object[]) => page.addInitScript((stored) => {
    localStorage.setItem('departs-ride', JSON.stringify({ state: { trips: stored, followed: null, unfollowedKey: null }, version: 4 }));
}, trips);

const storedTrips = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('departs-ride') ?? '{}').state?.trips ?? []);

test.describe('My trip', () => {
    test('takes a trip from a board: boarding stop preset, exit picked, bar shown, trip ended from its card', async ({ page }) => {
        await mockTrip(page);
        await page.goto('/prague/stop/U1111Z1P');

        await page.getByTestId('my-trip-bell').first().click();
        const sheet = page.getByRole('dialog').filter({ has: page.getByTestId('my-trip-save') });
        await expect(sheet).toBeVisible();
        // The board's stop is the boarding stop, with a lead preselected.
        await expect(sheet.getByText('Hlavní nádraží', { exact: false }).first()).toBeVisible();
        await sheet.getByRole('button', { name: /Boarding|Nástup/ }).click();
        await expect(sheet.locator('[data-slot=toggle-group-item][aria-pressed=true]')).toHaveCount(1);

        await sheet.getByRole('button', { name: /Getting off|Výstup|Výstup/ }).click();
        await sheet.getByRole('button', { name: /Florenc/ }).click();
        await sheet.getByTestId('my-trip-save').click();
        await expect(sheet).toBeHidden();

        const bar = page.getByTestId('boarding-bar');
        await expect(bar).toContainText('Hlavní nádraží');
        const trips = await page.evaluate(() => JSON.parse(localStorage.getItem('departs-ride') ?? '{}').state?.trips);
        expect(trips).toHaveLength(1);
        expect(trips[0]).toMatchObject({ tripId: 'trip-1', exitStopName: 'Florenc', toEnd: false, board: { stopName: 'Hlavní nádraží' } });

        // The bar opens the trip, whose card shows both stops and ends the trip.
        await bar.getByRole('button').first().click();
        const card = page.getByTestId('my-trip-card');
        await expect(card).toContainText('Florenc');
        await card.getByRole('button', { name: /End trip|Ukončit cestu/ }).click();
        await expect(page.getByTestId('boarding-bar')).toHaveCount(0);
    });

    // The boarding alert is optional: the boarding stop alone still starts the exit watch.
    test('saves a boarding stop without an alert', async ({ page }) => {
        await mockTrip(page);
        await page.goto('/prague/stop/U1111Z1P');
        await page.getByTestId('my-trip-bell').first().click();
        const sheet = page.getByRole('dialog').filter({ has: page.getByTestId('my-trip-save') });
        await sheet.getByRole('button', { name: /Boarding|Nástup/ }).click();
        await sheet.getByRole('button', { name: /No alert|Bez upozornění/ }).click();
        await expect(sheet.locator('[data-slot=toggle-group-item][aria-pressed=true]')).toHaveText(/No alert|Bez upozornění/);
        await sheet.getByRole('button', { name: /Getting off|Výstup/ }).click();
        await sheet.getByRole('button', { name: /Florenc/ }).click();
        await sheet.getByTestId('my-trip-save').click();
        await expect(sheet).toBeHidden();
        expect(await storedTrips(page)).toMatchObject([{ tripId: 'trip-1', exitSequence: 2, board: { sequence: 1, leadMin: null } }]);
    });

    test('follows a trip shared with its boarding stop and exit', async ({ page }) => {
        await mockTrip(page);
        await page.goto('/prague/trip/trip-1/veh-1?board=1&exit=2');

        await expect(page.getByTestId('follow-boarding-bar')).toContainText('Hlavní nádraží');
        const followed = await page.evaluate(() => JSON.parse(localStorage.getItem('departs-ride') ?? '{}').state?.followed);
        expect(followed).toMatchObject({ tripId: 'trip-1', exitSequence: 2, toEnd: false, board: { sequence: 1 } });
    });

    test('ignores a shared link naming a stop the trip does not have', async ({ page }) => {
        await mockTrip(page);
        await page.goto('/prague/trip/trip-1/veh-1?exit=99');
        await expect(page.getByTestId('vehicle-headsign')).toHaveText('Letňany');
        const followed = await page.evaluate(() => JSON.parse(localStorage.getItem('departs-ride') ?? '{}').state?.followed ?? null);
        expect(followed).toBeNull();
    });

    test('opens the My trip sheet from the departure row right-click menu', async ({ page }) => {
        await mockTrip(page);
        await page.goto('/prague/stop/U1111Z1P');
        await page.getByTestId('departure-item-trip-1').click({ button: 'right' });
        await page.getByRole('menuitem', { name: /taking this trip|Jedu tímto spojem/ }).click();
        await expect(page.getByTestId('my-trip-save')).toBeVisible();
    });

    // Already aboard and riding to the end is a valid trip: tracked in the bar, with no alerts.
    test('saves a trip taken already aboard to its end', async ({ page }) => {
        await mockTrip(page, { running: true });
        await page.goto('/prague/trip/trip-1/veh-1');
        await page.getByRole('button', { name: /taking this trip|Jedu tímto spojem/ }).first().click();
        const save = page.getByTestId('my-trip-save');
        await expect(save).toBeEnabled();
        await save.click();
        await expect(save).toBeHidden();
        expect(await storedTrips(page)).toMatchObject([{ tripId: 'trip-1', board: null, toEnd: true }]);
        await expect(page.getByTestId('my-trip-card')).toBeVisible();
    });

    // Only a running trip can be taken already aboard: one not yet running boards at a stop.
    test('boards a trip not yet running at its first stop, without the aboard choice', async ({ page }) => {
        await mockTrip(page);
        await page.goto('/prague/trip/trip-1/veh-1');
        await page.getByRole('button', { name: /taking this trip|Jedu tímto spojem/ }).first().click();
        const sheet = page.getByRole('dialog').filter({ has: page.getByTestId('my-trip-save') });
        await sheet.getByRole('button', { name: /Boarding|Nástup/ }).click();
        await sheet.getByRole('button', { name: /Another stop|Jiná zastávka/ }).click();
        await expect(sheet.getByRole('button', { name: /No boarding stop|Bez nástupu/ })).toHaveCount(0);
        await expect(sheet.locator('button[aria-pressed=true]')).toHaveText(/Hlavní nádraží/);
        await sheet.getByTestId('my-trip-save').click();
        await expect(sheet).toBeHidden();
        expect(await storedTrips(page)).toMatchObject([{ tripId: 'trip-1', board: { sequence: 1 } }]);
    });

    test('edits a saved trip in place: still one trip, the new exit', async ({ page }) => {
        await mockTrip(page);
        await seedTrips(page, [savedTrip('trip-1')]);
        await page.goto('/prague/stop/U1111Z1P');
        await page.getByTestId('my-trip-bell').first().click();
        const sheet = page.getByRole('dialog').filter({ has: page.getByTestId('my-trip-save') });
        await sheet.getByRole('button', { name: /Getting off|Výstup/ }).click();
        await sheet.getByRole('button', { name: /^Vysočanská/ }).click();
        await sheet.getByTestId('my-trip-save').click();
        await expect(sheet).toBeHidden();
        expect(await storedTrips(page)).toMatchObject([{ tripId: 'trip-1', exitSequence: 3, exitStopName: 'Vysočanská', board: { sequence: 1 } }]);
    });

    test('shares a trip before boarding with its boarding stop and exit in the link', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await mockTrip(page);
        await seedTrips(page, [savedTrip('trip-1')]);
        await page.goto('/prague/stop/U1111Z1P');
        const bar = page.getByTestId('boarding-bar');
        await expect(bar).toBeVisible();
        await bar.getByRole('button', { name: /Share trip|Sdílet cestu/ }).click();
        const shared = await page.evaluate(() => navigator.clipboard.readText());
        expect(shared).toContain('/prague/trip/trip-1/veh-1?board=1&exit=2');
        expect(shared).toContain('Hlavní nádraží');
        expect(shared).toContain('Florenc');
    });

    test('stacks two trips behind a tab and fans them out', async ({ page }) => {
        await mockTrip(page);
        await seedTrips(page, [savedTrip('trip-1'), savedTrip('trip-2')]);
        await page.goto('/prague/stop/U1111Z1P');
        const tab = page.getByRole('button', { name: /Show all trips|Rozbalit cesty/ });
        await expect(tab).toContainText('+1');
        await tab.click();
        await expect(page.getByTestId('boarding-bar')).toHaveCount(2);
        await expect(page.getByTestId('boarding-bar').nth(1)).toBeVisible();
    });

    // Another city's trip is kept (its pushes still come), but only the current city's trips get a bar.
    test('hides a trip in another city without ending it', async ({ page }) => {
        await mockTrip(page);
        await seedTrips(page, [savedTrip('trip-1'), savedTrip('trip-b', 'brno')]);
        await page.goto('/prague/stop/U1111Z1P');
        await expect(page.getByTestId('boarding-bar')).toHaveCount(1);
        await expect(page.getByRole('button', { name: /Show all trips|Rozbalit cesty/ })).toHaveCount(0);
        expect((await storedTrips(page)).map((t: { tripId: string }) => t.tripId)).toEqual(['trip-1', 'trip-b']);
    });
});
