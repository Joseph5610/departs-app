import { test, expect } from '@playwright/test';

test('capture settings and alerts with data', async ({ page }) => {
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

  // Open Settings
  await page.click('button[aria-label="Settings"], button:has-text("Settings")');
  await page.waitForSelector('text=Settings');

  // Ensure filters are visible (they are under Live vehicle locations)
  // If they are collapsed, we might need to click.
  const filtersVisible = await page.isVisible('text=Tram');
  if (!filtersVisible) {
     // The filters are in a Collapsible that is open when liveLocations is true.
     // Let's check if they are there.
  }

  await page.screenshot({ path: 'verification/settings_modal_detail.png' });

  // Close Settings
  await page.click('button[aria-label="Close"], .sr-only:has-text("Close")');

  // Open Alerts
  await page.click('button[aria-label="Alerts"], button:has-text("Alerts")');
  await page.waitForSelector('text=Incidents and Exclusions');

  await page.screenshot({ path: 'verification/alerts_modal_detail.png' });
});
