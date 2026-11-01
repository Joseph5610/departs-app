import { chromium } from 'playwright';
const b = await chromium.launch(); const res = {};
for (const [name, base] of [['prod', 'https://departs.app'], ['new', 'http://localhost:8788']]) {
  const c = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  await c.addInitScript(() => localStorage.setItem('departs-preferences', JSON.stringify({ state: { hasSeenWelcome: true, selectedCity: 'prague', language: 'sk' }, version: 0 })));
  const p = await c.newPage(); p.setDefaultTimeout(10000); await p.goto(base + '/prague'); await p.waitForTimeout(3500);
  await p.getByTestId('map-settings-btn').first().click(); await p.waitForTimeout(1800);
  res[name] = await p.evaluate(() => { const o = {}; for (const e of document.querySelectorAll('[role=dialog] *')) { const t = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').trim(); if (!t || t.length < 4) continue; const s = getComputedStyle(e); o[t.slice(0, 26)] = `${s.fontSize}/${s.fontWeight}/${s.lineHeight}/${s.letterSpacing}/${s.fontFeatureSettings}/${s.webkitFontSmoothing}/${s.color.slice(0, 26)}`; } return o; });
  await c.close();
}
for (const [k, v] of Object.entries(res.prod)) { const n = res.new[k]; if (n && n !== v) console.log(k.padEnd(27), v, '=>', n); }
await b.close();
