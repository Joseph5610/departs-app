
import { test, expect } from '@playwright/test';

test('Verify Alerts Modal Performance and UI', async ({ page }) => {
  await page.route('**/api/rss', async route => {
    const alerts = [];
    for (let i = 0; i < 5; i++) {
      alerts.push({
        type: 'incident',
        title: `Incident ${i}`,
        description: `Description for incident ${i}`,
        link: 'https://example.com',
        priority: 'high',
        isActive: true,
        valid_from: '1. 1. 2024 08:00',
        valid_to: null,
        line_metadata: [{ name: 'A', route_color: '#00b140', type: 'metro' }]
      });
    }
    for (let i = 0; i < 250; i++) {
      alerts.push({
        type: 'exclusion',
        title: `Exclusion ${i}`,
        description: `Description for exclusion ${i}`,
        link: 'https://example.com',
        priority: 'normal',
        isActive: true,
        valid_from: '1. 1. 2024 08:00',
        valid_to: '31. 12. 2024 20:00',
        line_metadata: [{ name: '1', route_color: '#ff0000', type: 'tram' }]
      });
    }
    await route.fulfill({ json: { alerts } });
  });

  await page.goto('http://localhost:8788/?skipTutorial');
  await page.click('[data-testid="map-alerts-btn"]');

  // Take screenshot of Incidents (small list, should be fast)
  await page.waitForSelector('text=Incident 0');
  await page.screenshot({ path: '/home/jules/verification/incidents.png' });

  // Switch to Exclusions (large list, should be fast)
  await page.click('button:has-text("EXCLUSIONS")');
  await page.waitForSelector('text=Exclusion 0');
  await page.screenshot({ path: '/home/jules/verification/exclusions.png' });
});
