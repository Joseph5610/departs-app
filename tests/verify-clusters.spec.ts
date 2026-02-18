import { test, expect } from '@playwright/test';

test('verify clusters and RSS', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('departs_welcome_seen', 'true');
    window.localStorage.setItem('i18nextLng', 'cs');
  });

  await page.goto('http://localhost:8788/');

  // Wait for map to load
  await page.waitForTimeout(5000);

  // Take screenshot to see clusters
  await page.screenshot({ path: 'verification/clusters.png' });

  // Open alerts to verify RSS
  await page.click('button[title="Mimořádnosti a výluky"]');
  await expect(page.locator('text=Mimořádnosti a výluky')).toBeVisible();
  await page.screenshot({ path: 'verification/alerts.png' });
});
