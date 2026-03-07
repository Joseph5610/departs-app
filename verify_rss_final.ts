import { test, expect } from '@playwright/test';

test('verify rss modal', async ({ page }) => {
  // Listen for console logs
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:4173');

  // Wait for app to load
  await page.waitForSelector('canvas', { timeout: 15000 });

  // Close welcome modal if present
  const welcomeBtn = page.getByRole('button', { name: /Začínáme|Get Started/ });
  if (await welcomeBtn.isVisible()) {
    await welcomeBtn.click();
  }

  // Click the alerts button (triangle exclamation)
  // It should have an aria-label or we can find it by the icon
  const alertsBtn = page.locator('button[aria-label*="Mimořádnosti"], button[aria-label*="Alerts"]');
  await expect(alertsBtn).toBeVisible();
  await alertsBtn.click();

  // Wait for modal to appear
  await page.waitForSelector('text=Dopravní omezení', { timeout: 10000 });
  await page.screenshot({ path: 'verify_rss_modal_open.png' });

  // Check if we have items
  const alertItems = page.locator('div.rounded-xl.border');
  console.log('Number of alert items found:', await alertItems.count());

  // Switch to exclusions tab
  await page.getByRole('tab', { name: /Výluky|Exclusions/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verify_rss_exclusions_open.png' });
});
