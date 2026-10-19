import { test, expect } from '@playwright/test';
import { hlavniNadrazi, mockStops, STOPS_FILE_URL } from '../fixtures/stops';
import { MapPage } from '../page-objects/MapPage';
import { SearchPage } from '../page-objects/SearchPage';

test.describe('Smoke tests', () => {
    test('should load the map and search for a stop', async ({ page }) => {
        const mapPage = new MapPage(page);
        const searchPage = new SearchPage(page);

        // Mock the massive stop file with a lightweight payload so parallel CI runs don't download it
        await mockStops(page, hlavniNadrazi());

        // Wait for the stops API response to finish loading so the stop search index is fully built
        const stopsResponsePromise = page.waitForResponse(
            response => STOPS_FILE_URL.test(response.url()) && response.status() === 200,
            { timeout: 30000 }
        );

        await mapPage.goto();
        await stopsResponsePromise;
        
        // Verify map controls are visible (indicates map loaded)
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });

        // Search for a known stop (example: 'Hlavní nádraží')
        await searchPage.search("Hlavn\u00ed n\u00e1dra\u017e\u00ed");
        
        // Look for the stop in results (using the Page Object)
        const stopNameRegex = new RegExp("Hlavn\u00ed\\sn\u00e1dra\u017e\u00ed");
        const stopItem = searchPage.getStopSearchItem(stopNameRegex);
        await expect(stopItem).toBeVisible({ timeout: 15000 });
        
        // Click the stop using the Page Object action
        await searchPage.selectStopByRegex(stopNameRegex);
        
        // Verify detail panel opens
        await expect(mapPage.detailPanel).toBeVisible();
    });
});
