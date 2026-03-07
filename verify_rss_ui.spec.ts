import { test, expect } from '@playwright/test';

test('RSS Modal shows consolidated data and no description', async ({ page }) => {
  // Mock the consolidated API response
  await page.route('**/api/rss', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        incidents: [
          {
            title: "Test Incident",
            link: "http://example.com/1",
            pubDate: new Date().toISOString(),
            isoDate: new Date().toISOString(),
            priority: "1",
            lines: ["A", "123"],
            isActive: true,
            isFuture: false
          }
        ],
        exclusions: [
          {
            title: "Test Exclusion",
            link: "http://example.com/2",
            pubDate: new Date().toISOString(),
            isoDate: new Date().toISOString(),
            priority: "2",
            lines: ["B"],
            isActive: true,
            isFuture: false,
            dateFrom: "1.1.2024",
            dateTo: "2.1.2024"
          }
        ]
      }),
    });
  });

  await page.goto('http://localhost:5173');

  // Dismiss welcome modal
  await page.click('button:has-text("Začínáme"), button:has-text("Get Started")');

  // Open Alerts modal
  await page.click('button[title="Incidents and Exclusions"]');

  // Verify Incident is visible
  await expect(page.locator('text=Test Incident')).toBeVisible();
  await expect(page.locator('text=A, 123')).toBeVisible();

  // Take screenshot of Incidents
  await page.screenshot({ path: 'verify_rss_incidents_mock.png' });

  // Switch to Exclusions
  await page.click('button:has-text("Exclusions")');

  // Verify Exclusion is visible
  await expect(page.locator('text=Test Exclusion')).toBeVisible();
  await expect(page.locator('text=B')).toBeVisible();
  await expect(page.locator('text=1.1.2024 - 2.1.2024')).toBeVisible();

  // Take screenshot of Exclusions
  await page.screenshot({ path: 'verify_rss_exclusions_mock.png' });
});
