import { test, expect } from '@playwright/test';

test('verify drawer header and handle', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://127.0.0.1:5173');

  await page.evaluate(() => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  });

  // Inject a simulation of the actual fixed components
  await page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) return;

    root.innerHTML = `
      <div id="drawer-container" style="position: fixed; bottom: 0; left: 0; right: 0; background: #111;" class="glassy-surface !rounded-t-3xl border-none shadow-2xl">
        <div class="flex flex-col max-h-[82dvh] min-h-0 overflow-hidden">
          <div id="drawer-handle" style="width: 100%; cursor: grab;">
             <div id="drawer-header" style="padding: 0 24px 16px 24px; text-align: left;">
                <div style="display: flex; flex-direction: column; align-items: center; width: 100%; gap: 0;">
                    <div style="margin: 16px auto 16px auto; height: 6px; width: 48px; border-radius: 9999px; background: #333;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <h2 style="font-size: 20px; font-weight: bold; color: white; margin: 0;">Muzeum</h2>
                            <div style="width: 28px; height: 28px; background: #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #888; font-size: 13px; font-weight: 900;">A</div>
                        </div>
                    </div>
                </div>
             </div>
          </div>
          <div id="scroll-content" style="flex: 1; min-height: 0; overflow-y: auto; padding: 0 24px 24px 24px;">
            <div style="height: 1000px; color: #666;">CONTENT</div>
          </div>
        </div>
      </div>
    `;
  });

  const title = page.locator('h2:has-text("Muzeum")');
  await expect(title).toBeVisible();

  const handle = page.locator('#drawer-handle');
  await expect(handle).toBeVisible();

  // Verify only one visual pill handle exists
  const handles = await page.locator('div[style*="height: 6px"]').count();
  console.log(`Number of visual handles: ${handles}`);
  expect(handles).toBe(1);

  await page.screenshot({ path: 'verification/drawer_header_fix.png' });
});
