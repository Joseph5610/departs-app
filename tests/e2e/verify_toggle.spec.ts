import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 400, height: 800 },
  deviceScaleFactor: 2,
});

test('capture departure board header toggle group', async ({ page }) => {
  // Use deep link to skip search
  await page.goto('http://localhost:8788/?stopId=U808Z2P&stopName=Muzeum');
  await page.evaluate(() => localStorage.setItem('departs_welcome_seen', 'true'));
  await page.reload();

  // Wait for the detail panel
  await page.waitForSelector('text=UPCOMING DEPARTURES', { timeout: 15000 });

  // Wait for animations
  await page.waitForTimeout(2000);

  // Capture screenshot
  await page.screenshot({ path: '/home/jules/verification/departure_header_toggle_direct.png' });
});
