
import { test, expect } from '@playwright/test';

test('verify pwa layout final', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });

  await page.goto('http://localhost:5173');

  await page.waitForSelector('.maplibregl-canvas');

  const dimensions = await page.evaluate(() => {
    const getDim = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        height: rect.height,
        width: rect.width,
        top: rect.top,
        left: rect.left,
      };
    };

    return {
      window: { innerHeight: window.innerHeight },
      html: getDim('html'),
      body: getDim('body'),
      root: getDim('#root'),
      mapContainer: getDim('.fixed.inset-0.bg-black.overflow-hidden'),
      canvas: getDim('.maplibregl-canvas')
    };
  });

  console.log('Final Dimensions:', JSON.stringify(dimensions, null, 2));

  const windowHeight = dimensions.window.innerHeight;

  expect(dimensions.html.height).toBeGreaterThanOrEqual(windowHeight);
  expect(dimensions.body.height).toBeGreaterThanOrEqual(windowHeight);
  expect(dimensions.mapContainer.height).toBeCloseTo(windowHeight, 0);
  expect(dimensions.canvas.height).toBeCloseTo(windowHeight, 0);

  await page.screenshot({ path: 'verification/final_check.png' });
});
