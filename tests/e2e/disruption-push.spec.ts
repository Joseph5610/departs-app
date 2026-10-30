import { test, expect, type Page } from '@playwright/test';
import { mockStops, singlePlatformStations } from '../fixtures/stops';
import { AlertsPage } from '../page-objects/AlertsPage';
import { MapPage } from '../page-objects/MapPage';
import { SettingsPage } from '../page-objects/SettingsPage';

const SUBSCRIPTION = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/e2e',
    keys: { p256dh: `B${'A'.repeat(86)}`, auth: 'A'.repeat(22) },
};

/** Opens `city` (at `search`) with tram 17 pinned, the given alerts and a push manager that subscribes without asking. */
const open = async (page: Page, city: string, { alerts = [] as object[], search = '', preferences = {} } = {}) => {
    await page.addInitScript(({ city, subscription, preferences }) => {
        window.localStorage.setItem('departs-preferences', JSON.stringify({
            state: { hasSeenWelcome: true, selectedCity: city, favoriteLines: [{ city, stopId: 'S1', line: '17', headsign: 'Sídliště Barrandov' }], ...preferences },
            version: 0,
        }));
        const sub = { endpoint: subscription.endpoint, toJSON: () => subscription };
        let current: typeof sub | null = 'disruptionPush' in preferences && !('noSubscription' in preferences) ? sub : null;
        const pushManager = { getSubscription: async () => current, subscribe: async () => (current = sub) };
        Object.defineProperty(navigator.serviceWorker, 'getRegistration', { value: async () => ({ pushManager }) });
        Object.defineProperty(navigator.serviceWorker, 'ready', { value: Promise.resolve({ pushManager }) });
    }, { city, subscription: SUBSCRIPTION, preferences });
    await mockStops(page, {
        ...singlePlatformStations([{ id: 'S1', name: 'Vltavská', pos: [14.4385, 50.0995], routes: ['L17'] }]),
        routes: { L17: { name: '17', type: 'tram', route_color: '7A0603' } },
    });
    await page.route('**/api/*/alerts', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerts }) }));
    await page.goto(`/${city}${search}`);
    const mapPage = new MapPage(page);
    await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });
    return mapPage;
};

const openSettings = async (page: Page, city: string) => {
    await (await open(page, city)).openSettings();
    return new SettingsPage(page);
};

const recordBodies = async (page: Page) => {
    const bodies: unknown[] = [];
    await page.route('**/api/*/disruptions', async (route) => {
        bodies.push({ ...route.request().postDataJSON(), url: new URL(route.request().url()).pathname });
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    return bodies;
};

test.describe('Disruption push', () => {
    test('registers the pinned lines with the keys their alerts use', async ({ page }) => {
        const bodies = await recordBodies(page);
        const settings = await openSettings(page, 'prague');

        const toggle = settings.disruptionPushRow.getByRole('switch');
        await expect(toggle).toHaveAttribute('aria-checked', 'false');
        await settings.disruptionPushRow.click();
        await expect(toggle).toHaveAttribute('aria-checked', 'true');
        await expect.poll(() => bodies.length).toBeGreaterThan(0);
        expect(bodies[0]).toMatchObject({ action: 'add', subscription: SUBSCRIPTION, lines: [{ name: '17', keys: ['17', 'L17'] }], path: '/prague' });

        await settings.disruptionPushRow.click();
        await expect(toggle).toHaveAttribute('aria-checked', 'false');
        await expect.poll(() => bodies.at(-1)).toMatchObject({ action: 'remove', endpoint: SUBSCRIPTION.endpoint });
    });

    test('is not offered in a city without an alerts feed', async ({ page }) => {
        const settings = await openSettings(page, 'presov');
        await expect(settings.container).toBeVisible();
        await expect(settings.disruptionPushRow).toHaveCount(0);
    });

    test('is offered in the alerts view while it is off', async ({ page }) => {
        const bodies = await recordBodies(page);
        await (await open(page, 'prague')).openAlerts();
        const alerts = new AlertsPage(page);

        await alerts.disruptionPushRow.click();
        await expect(alerts.disruptionPushRow.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
        await expect.poll(() => bodies.length).toBeGreaterThan(0);
        expect(bodies[0]).toMatchObject({ action: 'add', lines: [{ name: '17', keys: ['17', 'L17'] }] });
    });

    test('opens the alert a notification names', async ({ page }) => {
        const alert = { type: 'incident', title: 'Accident at Anděl', description: 'Trams 17 diverted via Palmovka', link: '', valid_from: null, valid_to: null, guid: 'pid-42', lines: ['L17'] };
        await open(page, 'prague', { alerts: [alert], search: '?alert=pid-42' });
        const alerts = new AlertsPage(page);
        await expect(alerts.container).toBeVisible();
        await expect(alerts.container.getByText('Trams 17 diverted via Palmovka')).toBeVisible();
        await expect(page).not.toHaveURL(/alert=/);
    });

    test('keeps every pinned city registered, not only the selected one', async ({ page }) => {
        const bodies = await recordBodies(page);
        await open(page, 'prague', { preferences: {
            disruptionPush: true,
            favoriteLines: [
                { city: 'prague', stopId: 'S1', line: '17', headsign: 'Sídliště Barrandov' },
                { city: 'brno', stopId: 'S1', line: '17', headsign: 'Sídliště Barrandov' },
            ],
        } });
        await expect.poll(() => bodies.length, { timeout: 10_000 }).toBe(2);
        expect(bodies.map(body => (body as { url: string }).url).sort()).toEqual(['/api/brno/disruptions', '/api/prague/disruptions']);
    });

    // Without a subscription and without permission nothing can arrive, so the switch must not read on.
    test('turns the switch off when notifications are gone', async ({ page }) => {
        const mapPage = await open(page, 'prague', { preferences: { disruptionPush: true, noSubscription: true } });
        await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('departs-preferences') ?? '{}').state?.disruptionPush), { timeout: 10_000 }).toBe(false);
        await mapPage.openSettings();
        await expect(new SettingsPage(page).disruptionPushRow.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    test('reads nothing for the feature while it is off', async ({ page }) => {
        const reads: string[] = [];
        page.on('request', (request) => {
            if (/\/alerts$|routes\.json/.test(new URL(request.url()).pathname)) reads.push(request.url());
        });
        await page.goto('/privacy');
        await expect(page.getByRole('heading').first()).toBeVisible();
        await page.waitForTimeout(500);
        expect(reads).toEqual([]);
    });
});
