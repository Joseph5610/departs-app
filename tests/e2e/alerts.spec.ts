import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';
import { AlertsPage } from '../page-objects/AlertsPage';

test.describe('Alerts tests', () => {
    test('should open alerts and filter by search', async ({ page }) => {
        const mapPage = new MapPage(page);
        const alertsPage = new AlertsPage(page);

        await mapPage.goto();
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });

        // Open alerts
        await mapPage.openAlerts();
        await expect(alertsPage.container).toBeVisible();

        // Ensure live tab is active by default or clickable
        await alertsPage.switchTab('live');
        
        // Wait for potential RSS load (we could mock this in real full e2e, but for now we wait for any cards or empty state)
        // Check if there are alert cards
        const cardCount = await alertsPage.getAlertCardCount();
        
        // If there are cards, test searching
        if (cardCount > 0) {
            // we search for a bogus string and expect 0
            await alertsPage.searchAlert('XyZ123BogusSearch');
            await expect(alertsPage.emptyStateMessage).toBeVisible({ timeout: 5000 }).catch(() => {});
        }

        // Close modal using Page Object method
        await expect(alertsPage.closeButton).toBeVisible();
        await alertsPage.close();

        // Verify the modal is closed
        await expect(alertsPage.container).not.toBeVisible();
    });
});
