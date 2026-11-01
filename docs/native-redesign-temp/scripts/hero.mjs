import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [name, base] of [['new', 'http://localhost:8788'], ['prod', 'https://departs.app']]) for (const theme of ['light', 'dark']) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme });
  await c.addInitScript(([t]) => { localStorage.setItem('departs-preferences', JSON.stringify({ state: { hasSeenWelcome: true, selectedCity: 'prague', language: 'sk' }, version: 0 })); localStorage.setItem('theme', t); }, [theme]);
  const p = await c.newPage(); p.setDefaultTimeout(12000);
  try {
    await p.goto(base + '/prague/stop/U142-1'); await p.waitForTimeout(4500);
    await p.locator('[data-testid^=departure-item-]').first().tap(); await p.waitForTimeout(3500);
    const hero = p.locator('[data-slot=card]').filter({ has: p.getByTestId('vehicle-headsign') }).first();
    console.log(name, theme, await hero.evaluate(e => { const s = getComputedStyle(e); return [s.backgroundImage.slice(0, 150), s.backgroundColor, s.boxShadow.slice(0, 60), s.borderTopWidth]; }));
    await hero.screenshot({ path: `scratch/hero-${name}-${theme}.png` });
  } catch (e) { console.log('FAIL', name, theme, String(e).split('\n')[0].slice(0, 90)); }
  await c.close();
}
await b.close();
