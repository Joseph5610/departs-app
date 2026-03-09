import { test, expect } from '@playwright/test';

test('Verify glassy theme consistency and detail panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173');

  const startButton = page.getByRole('button', { name: /Začínáme|Get Started/i });
  await page.screenshot({ path: 'verification/debug_start.png' });
  await expect(startButton).toBeVisible({ timeout: 15000 });
  await startButton.click();

  // 1. Verify Glassy Map Controls
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'verification/debug_after_modal.png' });
  const zoomIn = page.locator('button[aria-label="Zoom In"]');
  await expect(zoomIn).toBeVisible();
  await page.screenshot({ path: 'verification/glassy_controls_final.png', clip: { x: 330, y: 720, width: 60, height: 120 } });

  // 2. Verify Search Bar Glassy
  const searchInput = page.getByPlaceholder(/Search|Hledat/i);
  await expect(searchInput).toBeVisible();
  await page.screenshot({ path: 'verification/glassy_search_final.png', clip: { x: 10, y: 10, width: 370, height: 60 } });

  // 3. Open Detail Panel and Verify Content
  await searchInput.click();
  await searchInput.fill('Muzeum');
  const result = page.locator('button').filter({ hasText: 'Muzeum' }).first();
  await result.click();

  const drawer = page.locator('[role="dialog"]');
  await expect(drawer).toBeVisible();

  // Wait for content
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verification/glassy_drawer_final.png' });

  // 4. Verify Vehicle Detail within drawer (if we can find one)
  // We'll click a departure if available
  const departure = page.locator('button').filter({ hasText: /min|Now|Teď/i }).first();
  if (await departure.isVisible()) {
    await departure.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'verification/vehicle_detail_final.png' });
  }
});
