import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const state = { theme: process.env.SCHEME ?? 'dark', hasSeenWelcome: true, selectedCity: 'brno', language: 'sk', favoriteStops: [{ city: 'brno', stopId: 'U1073Z2' }, { city: 'brno', stopId: 'U1073' }], favoriteLines: [{ city: 'brno', stopId: 'U1073Z2', line: '4', headsign: 'Bystrc, Ečerova' }], searchHistory: [{ type: 'line', city_slug: 'brno', lines: ['4'], timestamp: 3 }, { type: 'stop', city_slug: 'brno', stop_id: 'U1073Z2', stop_name: 'Česká', timestamp: 1 }] };
const SIZES = new Set(['20/700', '17/700', '15/600', '14/500', '14/600', '13/600', '13/400', '13/500', '12/400', '12/500', '12/600', '11/700', '10/700', '9/700', '9/400', '15/700', '13/700', '12/700', '16/400', '14/400']);
const RADII = new Set(['0px', '6px', '16px', '22px', '38px', '34px']);
const grab = () => {
  const text = {}, radius = {}, heights = {};
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('.maplibregl-map,script,style,svg,.maplibregl-canvas-container,iframe')) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const c = getComputedStyle(e); if (c.visibility === 'hidden') continue;
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (own) { const k = `${parseFloat(c.fontSize)}/${c.fontWeight}`; (text[k] ??= []).length < 3 && text[k].push(own.slice(0, 22)); }
    const rad = c.borderTopLeftRadius; const full = parseFloat(rad) >= r.height / 2 - 0.5;
    if (!full && rad !== '0px' && (c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.boxShadow !== 'none')) { (radius[rad] ??= []).length < 3 && radius[rad].push((e.dataset.slot || e.tagName.toLowerCase()) + ':' + (own || e.textContent).slice(0, 16)); }
    if (e.matches('button,a,[role=button]')) { const h = Math.round(r.height), k = String(h); (heights[k] ??= []).length < 3 && heights[k].push((e.getAttribute('aria-label') || e.textContent || e.dataset.testid || '').slice(0, 18)); }
  }
  return { text, radius, heights };
};
const report = {};
const run = async (kind, opts) => {
  const c = await b.newContext({ deviceScaleFactor: 1, colorScheme: process.env.SCHEME ?? 'dark', ...opts }); await c.addInitScript(s => { localStorage.setItem('departs-preferences', JSON.stringify({ state: s, version: 0 })); localStorage.setItem('i18nextLng', 'sk'); localStorage.setItem('theme', s.theme); }, state);
  const p = await c.newPage(); p.setDefaultTimeout(7000); const tap = l => kind === 'm' ? l.tap() : l.click();
  const shot = async n => { await p.waitForTimeout(700); report[`${kind}:${n}`] = await p.evaluate(grab); await p.screenshot({ path: `scratch/audit-${process.env.SCHEME ?? 'dark'}/${kind}-${n}.png` }); };
  const go = async (n, u, f) => { try { await p.goto('http://localhost:8788' + u); await p.waitForTimeout(2600); if (f) await f(); await shot(n); } catch (e) { console.log('FAIL', kind, n, String(e).split('\n')[0].slice(0, 90)); report[`${kind}:${n}`] = 'FAIL'; } };
  const grabber = async () => { if (kind === 'm') { await p.getByTestId('home-sheet-grabber').click(); await p.waitForTimeout(600); } };
  const trip = async () => { await tap(p.locator('[role=button][data-testid^=departure-item-]').first()); await p.waitForTimeout(2400); };
  await go('home', '/brno', grabber);
  await go('board', '/brno/stop/U1073Z2');
  await go('station', '/brno/stop/U1073');
  await go('expanded', '/brno/stop/U1073', async () => tap(p.locator('button[aria-expanded=false]').filter({ hasText: /^\+\d+/ }).first()));
  await go('trip', '/brno/stop/U1073', trip);
  await go('mytrip', '/brno/stop/U1073', async () => { await trip(); await tap(p.locator('button').filter({ hasText: /Idem týmto|taking this trip/ }).first()); });
  await go('ride', '/brno/stop/U1073', async () => { await trip(); await tap(p.locator('button').filter({ hasText: /Idem týmto|taking this trip/ }).first()); await p.waitForTimeout(1000); await tap(p.locator('button').filter({ hasText: /Idem týmto|taking this trip/ }).last()); await p.waitForTimeout(1200); });
  await go('fav', '/brno/favorites');
  await go('stats', '/brno/stats');
  await go('list', '/brno/stats', async () => tap(p.locator('button').filter({ hasText: /Zoznam vozidiel|Vehicle List/ }).first()));
  await go('settings', '/brno', async () => tap(p.getByTestId('map-settings-btn').first()));
  await go('alerts', '/brno', async () => { if (kind === 'm') { await grabber(); await p.getByTestId('home-alerts-row').evaluate(e => e.click()); } else await p.getByTestId('map-alerts-btn').click(); });
  await go('search', '/brno', async () => { if (kind === 'm') await tap(p.getByTestId('search-trigger')); else await p.locator('input').first().click(); });
  await go('feedback', '/brno', async () => { await tap(p.getByTestId('map-settings-btn').first()); await p.waitForTimeout(900); await tap(p.locator('button').filter({ hasText: /Odoslať spätnú|Send Feedback/ }).first()); await p.waitForTimeout(900); });
  await go('mcp', '/brno', async () => { await tap(p.getByTestId('map-settings-btn').first()); await p.waitForTimeout(900); await tap(p.locator('button').filter({ hasText: /AI [Ii]ntegr/ }).first()); await p.waitForTimeout(900); });
  await c.close();
};
await run('m', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await run('d', { viewport: { width: 1280, height: 860 } });
await b.close();
writeFileSync(`scratch/audit-${process.env.SCHEME ?? 'dark'}/report.json`, JSON.stringify(report));
const off = { text: new Map(), radius: new Map(), heights: new Map() };
const add = (m, k, n, ex) => { const v = m.get(k) ?? { n: new Set(), ex: new Set() }; v.n.add(n); ex.forEach(x => v.ex.add(x)); m.set(k, v); };
for (const [n, r] of Object.entries(report)) { if (r === 'FAIL') continue; for (const [k, ex] of Object.entries(r.text)) if (!SIZES.has(k)) add(off.text, k, n, ex); for (const [k, ex] of Object.entries(r.radius)) if (!RADII.has(k)) add(off.radius, k, n, ex); for (const [k, ex] of Object.entries(r.heights)) if (+k < 28) add(off.heights, k, n, ex); }
for (const [t, m] of Object.entries(off)) { console.log('== ' + t); for (const [k, v] of [...m].sort()) console.log(k.padEnd(12), [...v.n].slice(0, 4).join(',').padEnd(44), [...v.ex].slice(0, 3).join(' | ').slice(0, 60)); }
