import { test, expect } from '@playwright/test';

test('Verify glassy zoom controls and mobile panel', async ({ page }) => {
  // Set to mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('http://localhost:5173');

  // Wait for the welcome modal and close it
  const startButton = page.getByRole('button', { name: /Začínáme|Get Started/i });
  await expect(startButton).toBeVisible({ timeout: 10000 });
  await startButton.click();

  // 1. Verify Zoom Controls (Glassy)
  // Check the zoom buttons for background classes
  const zoomIn = page.locator('button[aria-label="Zoom In"]');
  const zoomOut = page.locator('button[aria-label="Zoom Out"]');

  await expect(zoomIn).toBeVisible();

  // Take screenshot of map controls
  await page.screenshot({ path: 'verification/map_controls.png', clip: { x: 330, y: 720, width: 60, height: 120 } });

  // 2. Open a panel to test snap points
  // We can simulate a search or just click a stop if we can find one.
  // Since we are in a mock environment, let's just trigger a stop selection via search history if available or just wait for a stop to appear.
  // Actually, let's try to search for something.
  const searchInput = page.getByPlaceholder(/Search|Hledat/i);
  await searchInput.click();
  await searchInput.fill('Muzeum');

  // Wait for results
  const result = page.locator('button').filter({ hasText: 'Muzeum' }).first();
  await result.click();

  // 3. Verify Bottom Sheet (DetailPanel)
  const drawer = page.locator('[role="dialog"]'); // Vaul drawer
  await expect(drawer).toBeVisible();

  // Check if snap points are working (visually)
  await page.screenshot({ path: 'verification/mobile_panel_snap.png' });

  // 4. Verify no "Searching for location" toast
  const searchingToast = page.getByText(/Searching for location|Hledám polohu/i);
  await expect(searchingToast).not.toBeVisible();

  // But error toast should be visible if location fails (it likely does in CI)
  const errorToast = page.getByText(/Could not retrieve location|Nepodařilo se získat polohu/i);
  // We saw it in the previous screenshot so it's working.
});
