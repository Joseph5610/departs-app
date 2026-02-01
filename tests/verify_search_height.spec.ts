import { test, expect } from '@playwright/test';

test('search bar height with text', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Wait for search input
  const searchInput = page.getByPlaceholder('Search stops...');
  await expect(searchInput).toBeVisible();

  // Type something
  await searchInput.fill('Muzeum');

  // Wait a bit for results
  await page.waitForTimeout(1000);

  // Take screenshot
  await page.screenshot({ path: '/home/jules/verification/search_with_text.png' });
});
