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
        const vehiclesSwitch = settingsPage.showVehiclesRow.getByRole('switch');
        await expect(vehiclesSwitch).toHaveAttribute('aria-checked', 'true');
        await settingsPage.showVehiclesRow.click();
        await expect(vehiclesSwitch).toHaveAttribute('aria-checked', 'false');

        // Toggle it back
        await settingsPage.showVehiclesRow.click();
        await expect(vehiclesSwitch).toHaveAttribute('aria-checked', 'true');

        // Ensure "metro" button exists (it should be visible when Live Vehicles is ON)
        const metroBtn = settingsPage.container.getByTestId('vehicle-type-metro');
        await expect(metroBtn).toBeVisible();

        // Toggle Show Stops
        const stopsSwitch = settingsPage.showStopsRow.getByRole('switch');
        const stopsWereShown = await stopsSwitch.getAttribute('aria-checked');
        await settingsPage.showStopsRow.click();
        await expect(stopsSwitch).toHaveAttribute('aria-checked', stopsWereShown === 'true' ? 'false' : 'true');

        // Close the modal using the Page Object method
        await expect(settingsPage.closeButton).toBeVisible();
        await settingsPage.close();

        // Verify the settings modal is closed
        await expect(settingsPage.container).not.toBeVisible();
    });
});
