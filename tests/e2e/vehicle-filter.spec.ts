import { test, expect } from '@playwright/test';
import { hlavniNadrazi, mockStops } from '../fixtures/stops';

const MIN = 60_000;

const departure = (tripId: string, isAirConditioned: boolean, inMs: number) => ({
    tripId, vehicleId: `veh-${tripId}`, line: 'C', headsign: 'Letňany', type: 'metro', directionId: '0', stopId: 'U1111Z1P',
    scheduled: new Date(Date.now() + inMs).toISOString(), timestamp: new Date(Date.now() + inMs).toISOString(),
    delay: 0, isCanceled: false, is_air_conditioned: isAirConditioned,
});

test.describe('Vehicle filters on a board', () => {
    // A remembered filter must not silently empty a board: it says what it hides and can be lifted there.
    test('names the filter hiding departures and shows them all again', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('departs-preferences', JSON.stringify({
                state: { hasSeenWelcome: true, selectedCity: 'prague', requireAirConditioned: true },
                version: 0,
            }));
        });
        await mockStops(page, hlavniNadrazi());
        await page.route('**/api/*/departures*', route => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ departures: [departure('cool', true, 2 * MIN), departure('hot', false, 4 * MIN)] }),
        }));
        await page.goto('/prague/stop/U1111Z1P');

        const notice = page.getByTestId('vehicle-filter-notice');
        await expect(notice).toBeVisible();
        await expect(page.getByTestId('departure-item-cool')).toBeVisible();
        await expect(page.getByTestId('departure-item-hot')).toHaveCount(0);

        await notice.getByRole('button', { name: /Show all|Zobrazit vše|Zobraziť všetky/ }).click();
        await expect(notice).toHaveCount(0);
        await expect(page.locator('[data-testid$="-hot"]').first()).toBeVisible();
        const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('departs-preferences') ?? '{}').state);
        expect(prefs.requireAirConditioned).toBe(false);
    });
});
