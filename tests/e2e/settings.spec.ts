import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';
import { SettingsPage } from '../page-objects/SettingsPage';

test.describe('Settings tests', () => {
    test('should open settings and toggle options', async ({ page }) => {
        const mapPage = new MapPage(page);
        const settingsPage = new SettingsPage(page);

        await mapPage.goto();
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });

        // Open settings
        await mapPage.openSettings();
        await expect(settingsPage.container).toBeVisible();

        // Toggle Live Vehicles switch by clicking the row
        await settingsPage.showVehiclesRow.click({ force: true });
        await page.waitForTimeout(300);
        
        // Toggle it back
        await settingsPage.showVehiclesRow.click({ force: true });
        await page.waitForTimeout(300);
        
        // Ensure "metro" button exists (it should be visible when Live Vehicles is ON)
        const metroBtn = settingsPage.container.getByTestId('vehicle-type-metro');
        await expect(metroBtn).toBeVisible();

        // Toggle Show Stops
        await settingsPage.showStopsRow.click({ force: true });
        await page.waitForTimeout(300);

        // Close the modal using the Page Object method
        await expect(settingsPage.closeButton).toBeVisible();
        await settingsPage.close();

        // Verify the settings modal is closed
        await expect(settingsPage.container).not.toBeVisible();
    });
});
