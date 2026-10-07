import { test, expect } from '@playwright/test';
import { MapPage } from '../page-objects/MapPage';
import { SettingsPage } from '../page-objects/SettingsPage';

test.describe('Legal pages', () => {
    test('privacy policy renders with its contact and links to the terms', async ({ page }) => {
        await page.goto('/privacy');

        await expect(page.getByRole('heading', { level: 1, name: /Privacy policy|Zásady ochrany soukromí/i })).toBeVisible();
        await expect(page.getByText(/info@departs\.app/).first()).toBeVisible();
        await expect(page.getByText('{{')).toHaveCount(0);

        await page.getByRole('link', { name: /Terms of use|Podmínky užívání/i }).click();
        await expect(page).toHaveURL(/\/terms$/);
        await expect(page.getByRole('heading', { level: 1, name: /Terms of use|Podmínky užívání/i })).toBeVisible();
    });

    test('licences page credits each source with its licence', async ({ page }) => {
        await page.goto('/licenses');

        await expect(page.getByRole('heading', { level: 1, name: /Data sources & licences|Zdroje dat a licence/i })).toBeVisible();
        await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
        await expect(page.getByRole('link', { name: /CC BY 4\.0/i }).first()).toBeVisible();
        await expect(page.getByRole('link', { name: /documented here|zdokumentovány zde/i })).toHaveAttribute('href', /departs-data/);
        await expect(page.getByRole('link', { name: /Open-source libraries|Open-source knihovny/i })).toHaveAttribute('href', '/THIRD_PARTY_LICENSES.txt');
    });

    test('settings link to every document', async ({ page }) => {
        const mapPage = new MapPage(page);
        const settingsPage = new SettingsPage(page);

        await mapPage.goto();
        await expect(mapPage.mapControls).toBeVisible({ timeout: 15000 });
        await mapPage.openSettings();

        await expect(settingsPage.container.getByRole('link', { name: /Privacy policy|Zásady ochrany soukromí/i })).toHaveAttribute('href', '/privacy');
        await expect(settingsPage.container.getByRole('link', { name: /Terms of use|Podmínky užívání/i })).toHaveAttribute('href', '/terms');
        await expect(settingsPage.container.getByRole('link', { name: /Data sources & licences|Zdroje dat a licence/i })).toHaveAttribute('href', '/licenses');
    });
});
