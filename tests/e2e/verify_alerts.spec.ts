import { test, expect } from '@playwright/test';

test('capture alerts with data', async ({ page }) => {
  // Mock RSS API
  await page.route('**/api/rss', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        alerts: [
          {
            id: '1',
            title: 'Test Incident High Priority',
            description: 'This is a high priority incident description that should be very readable now.',
            valid_from: '1. 1. 2024 08:00',
            valid_to: '1. 1. 2024 20:00',
            priority: 'high',
            type: 'incident'
          },
          {
            id: '2',
            title: 'Normal Exclusion',
            description: 'This is a normal exclusion description. The text should not have extra opacity.',
            valid_from: '2. 1. 2024 09:00',
            valid_to: null,
            priority: 'normal',
            type: 'exclusion'
          }
        ]
      })
    });
  });

  await page.goto('http://localhost:8788');
  await page.evaluate(() => localStorage.setItem('departs_welcome_seen', 'true'));
  await page.reload();

  // Wait for map to be stable-ish
  await page.waitForTimeout(2000);

  // Take a screenshot of the map first to see if buttons are there
  await page.screenshot({ path: 'verification/map_debug.png' });

  // Try to click any button that looks like alerts
  const bellButton = page.locator('button:has(svg.lucide-bell)');
  if (await bellButton.count() > 0) {
    await bellButton.first().click();
  } else {
    // Fallback to searching by text if bell icon not found by class
    await page.click('button[aria-label*="Alert"], button[aria-label*="Mimořád"]');
  }

  await page.waitForSelector('text=Incidents', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'verification/alerts_modal_detail.png' });
});
