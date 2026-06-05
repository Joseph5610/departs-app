import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';

test.describe('Share functionality', () => {
    test('should copy correctly formatted stop URL to clipboard', async ({ page, context }) => {
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        
        const mapPage = new MapPage(page);

        // Mock stops and departures
        await page.route('**/api/*/stops*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [14.4332, 50.0831] },
                        properties: { stop_id: 'U1111Z1P', stop_name: 'Hlavní nádraží', lines: [] }
                    }]
                })
            });
        });

        await page.route('**/api/*/departures*', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ departures: [] }) });
        });

        // Navigate directly to a stop
        await mapPage.goto('/stop/U1111Z1P');
        
        await expect(mapPage.detailPanel).toBeVisible({ timeout: 15000 });

        // Find the share button in the DepartureBoardHeader
        const shareBtn = page.getByRole('button', { name: /Share|Sdílet/i }).first();
        await expect(shareBtn).toBeVisible();

        // Click it - since navigator.share is usually undefined in headless, it should fallback to clipboard
        await shareBtn.click();

        // Verify toast appeared
        await expect(page.getByText(/Odkaz bol skopírovaný|Link copied|Odkaz zkopírován/i).first()).toBeVisible();

        // Read clipboard
        const clipboardText = await page.evaluate("navigator.clipboard.readText()");
        
        // Assert it's the correct Wouter path
        expect(clipboardText).toContain('/stop/U1111Z1P');
        expect(clipboardText).not.toContain('?stopId=U1111Z1P');
    });
});
