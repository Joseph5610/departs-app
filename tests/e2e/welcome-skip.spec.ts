import { test, expect } from '@playwright/test';

test.describe('WelcomeModal skipTutorial parameter', () => {
    test('should skip welcome modal and set localStorage when ?skipTutorial is present', async ({ page }) => {
        // Go to home page with skipTutorial parameter
        // We DON'T use BasePage.goto here because it automatically sets the localStorage
        await page.goto('/?skipTutorial');

        // Verify URL is cleaned up (skipTutorial is removed) - this indicates the effect has run
        await expect(page).not.toHaveURL(/\?skipTutorial/, { timeout: 15000 });

        // Verify WelcomeModal is NOT visible
        const welcomeCta = page.getByTestId('welcome-cta');
        await expect(welcomeCta).not.toBeVisible();

        // Verify localStorage is set
        const welcomeSeen = await page.evaluate(() => {
            const prefs = localStorage.getItem('departs-preferences');
            if (!prefs) return null;
            try {
                return JSON.parse(prefs).state.hasSeenWelcome;
            } catch (e) {
                return null;
            }
        });
        expect(welcomeSeen).toBe(true);
    });

    test('should show welcome modal when ?skipTutorial is NOT present and not seen before', async ({ page }) => {
        // Clear localStorage first to ensure modal should show
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());

        // Reload page
        await page.goto('/');

        // Verify WelcomeModal IS visible
        const welcomeCta = page.getByTestId('welcome-cta');
        await expect(welcomeCta).toBeVisible();
    });
});
