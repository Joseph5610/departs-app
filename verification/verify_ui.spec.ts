import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

test('verify refactored ui', async ({ page }) => {
  // Set welcome seen
  await page.addInitScript(() => {
    window.localStorage.setItem('departs_welcome_seen', 'true');
  });

  await page.goto('http://localhost:8788');

  // Wait for map to load
  await page.waitForSelector('.maplibregl-canvas');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'v_main_map.png' });

  // Open settings
  await page.click('button[aria-label="Settings"], button:has(svg.lucide-settings)');
  await page.waitForSelector('[role="dialog"]');
  await page.screenshot({ path: 'v_settings.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Search
  await page.fill('input[placeholder*="Search"]', 'Hlavní nádraží');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'v_search_results.png' });

  // Click first result
  await page.click('button:has-text("Hlavní nádraží")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'v_stop_detail.png' });
});
