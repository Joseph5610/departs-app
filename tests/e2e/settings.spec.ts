import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';
import { SettingsPage } from '../page-objects/SettingsPage';

test.describe('Settings tests', () => {
    test('drags the thumb of a segmented control to another option', async ({ page }) => {
        const mapPage = new MapPage(page);
        const settingsPage = new SettingsPage(page);
        await mapPage.goto();
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });
        await mapPage.openSettings();
        await expect(settingsPage.container).toBeVisible();

        const light = settingsPage.container.getByTestId('theme-light');
        const system = settingsPage.container.getByTestId('theme-system');
        await light.click();
        const from = (await light.boundingBox())!;
        const to = (await system.boundingBox())!;
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
        await page.mouse.up();
        await expect(system).toHaveAttribute('aria-pressed', 'true');
    });

    test('uses the redesign tokens for cards and switches', async ({ page }) => {
        const mapPage = new MapPage(page);
        const settingsPage = new SettingsPage(page);

        await mapPage.goto();
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });
        await mapPage.openSettings();
        await expect(settingsPage.container).toBeVisible();

        const card = settingsPage.container.locator('[data-slot=card]').first();
        await expect(card).toHaveCSS('border-top-left-radius', '22px');
        await expect(card).toHaveCSS('border-top-width', '0px');
        await expect(card).toHaveCSS('box-shadow', 'none');

        const toggle = settingsPage.showVehiclesRow.getByRole('switch');
        await expect(toggle).toHaveCSS('width', '40px');
        await expect(toggle).toHaveCSS('height', '24px');
        await expect(toggle.locator('[data-slot=switch-thumb]')).toHaveCSS('width', '20px');
    });

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
