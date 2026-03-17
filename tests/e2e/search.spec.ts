import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';
import { SearchPage } from '../page-objects/SearchPage';

test.describe('Search tests', () => {
    test('should search for a line and open it', async ({ page }) => {
        const mapPage = new MapPage(page);
        const searchPage = new SearchPage(page);

        await mapPage.goto();
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });

        // Search for a line (e.g., '1')
        await searchPage.search('1');
        
        // Wait for results
        const lineItem = page.getByTestId('search-item-line-1');
        await expect(lineItem).toBeVisible();
        
        // Click the line
        await lineItem.click();
        
        // Verify search input shows the filter (it might show "Filtrovat linku 1" or "Filter line 1")
        await expect(searchPage.searchInput).toHaveValue(/1/);
    });
});
