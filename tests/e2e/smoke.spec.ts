import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';
import { SearchPage } from '../page-objects/SearchPage';

test.describe('Smoke tests', () => {
    test('should load the map and search for a stop', async ({ page }) => {
        const mapPage = new MapPage(page);
        const searchPage = new SearchPage(page);

        await mapPage.goto();
        
        // Verify map controls are visible (indicates map loaded)
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });

        // Search for a known stop (example: 'Hlavní nádraží')
        await searchPage.search("Hlavn\u00ed n\u00e1dra\u017e\u00ed");
        
        // Look for the stop in results (using space-agnostic RegExp matching to handle non-breaking spaces like '\u00a0')
        const stopItem = page.getByRole('button', { name: new RegExp("Hlavn\u00ed\\sn\u00e1dra\u017e\u00ed") }).first();
        await expect(stopItem).toBeVisible({ timeout: 15000 });
        
        // Click the stop
        await stopItem.click();
        
        // Verify detail panel opens
        await expect(mapPage.detailPanel).toBeVisible();
    });
});
