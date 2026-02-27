import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

test('verify refactored ui and mapcn', async ({ page }) => {
  // Set welcome seen
  await page.addInitScript(() => {
    window.localStorage.setItem('departs_welcome_seen', 'true');
    window.localStorage.setItem('departs_settings', JSON.stringify({ showVehicles: true }));
  });

  await page.goto('http://localhost:8788');

  // 1. Check Map and Controls
  await page.waitForSelector('.maplibregl-canvas');
  await page.waitForTimeout(2000); // Give time for map to render
  await page.screenshot({ path: '/home/jules/verification/main_map.png' });

  // 2. Check Settings (Shadcn Dialog)
  const settingsBtn = page.locator('button[aria-label="Settings"], button:has(svg.lucide-settings)');
  await expect(settingsBtn).toBeVisible();
  await settingsBtn.click();
  await page.waitForSelector('[role="dialog"]');
  await page.screenshot({ path: '/home/jules/verification/settings_dialog.png' });
  await page.keyboard.press('Escape');

  // 3. Check Search (Shadcn Input)
  const searchInput = page.locator('input[placeholder*="Search"]');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('Hlavní nádraží');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/jules/verification/search_results.png' });

  // 4. Check Detail Panel (Shadcn Sheet/ScrollArea)
  await page.click('button:has-text("Hlavní nádraží")');
  await page.waitForSelector('[data-state="open"]'); // DetailPanel uses shadcn Sheet
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/jules/verification/stop_detail.png' });
});
