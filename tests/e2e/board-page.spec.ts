import { test, expect } from '@playwright/test';
import { hlavniNadrazi, mockStops } from '../fixtures/stops';

test.describe('Full-screen board', () => {
    test('lists the stop\'s departures under its name, line badges keeping the app\'s corner proportion', async ({ page }) => {
        await page.setViewportSize({ width: 1180, height: 820 });
        await mockStops(page, hlavniNadrazi());
        const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
        const departures = [
            { tripId: 't1', line: '9', headsign: 'Spojovací', type: 'tram', platform: 'C', scheduled: at(2), timestamp: at(2), delay: 0, is_wheelchair_accessible: true, is_air_conditioned: true, route_color: '#7A4D9C' },
            { tripId: 't2', line: '136', headsign: 'Jižní Město', type: 'bus', platform: 'D', scheduled: at(5), timestamp: at(6), delay: 60, route_color: '#007DA8' },
        ];
        await page.route('**/api/*/departures*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures }) }));
        await page.goto('/prague/board/U1111Z1P');

        await expect(page.getByRole('heading', { name: /Hlavní nádraží/ })).toBeVisible({ timeout: 30000 });
        const rows = page.locator('ul > li');
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(0)).toContainText('Spojovací');
        // Only a platform other than the board's own (C) is named.
        await expect(rows.nth(0)).not.toContainText('platform C');
        await expect(rows.nth(1)).toContainText('platform D');

        const badge = rows.nth(0).getByText('9', { exact: true });
        const { radius, height } = await badge.evaluate(el => ({ radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), height: el.getBoundingClientRect().height }));
        expect(radius / height).toBeGreaterThan(0.2);
        expect(radius / height).toBeLessThan(0.3);
    });
});
