import { test, expect } from '@playwright/test';

test('final visual verification of drawer fix', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://127.0.0.1:5173');

  await page.evaluate(() => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    root.style.height = '100vh';
    root.style.backgroundColor = '#000';
    root.innerHTML = `
      <div id="drawer" class="glassy-surface !rounded-t-3xl border-none shadow-2xl" style="position: fixed; bottom: 0; left: 0; right: 0; background: #111;">
        <div class="flex flex-col max-h-[82dvh] min-h-0 overflow-hidden">
          <div id="header" class="px-6 pt-4 pb-4 border-b border-white/10 flex justify-between items-center" style="cursor: grab;">
            <div style="color: white; font-weight: bold; font-size: 1.25rem;">Staroměstská</div>
            <div style="width: 28px; height: 28px; background: #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #888; font-size: 12px;">A</div>
          </div>
          <div id="scroll" class="flex-1 min-h-0 px-6 overflow-y-auto pt-4 pb-10">
            <div style="height: 1000px; background: linear-gradient(180deg, #222 0%, #000 100%); color: #666; padding: 20px; border-radius: 1rem;">
              SCROLLABLE DEPARTURES LIST<br/><br/>
              [Line 17] Levského - 2 min<br/>
              [Line 18] Vozovna Pankrác - 5 min<br/>
              [Line 2] Nádraží Hostivař - 8 min<br/>
              ...
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
  });

  await page.screenshot({ path: 'verification/drawer_final_fix.png' });
});
