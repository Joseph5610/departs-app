import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const state = { hasSeenWelcome: true, selectedCity: 'prague', language: 'sk', favoriteStops: [{ city: 'prague', stopId: 'U713Z1P' }, { city: 'prague', stopId: 'U142-1' }], favoriteLines: [{ city: 'prague', stopId: 'U713Z1P', line: '26', headsign: 'Nádraží Hostivař' }], searchHistory: [{ type: 'line', city_slug: 'prague', lines: ['9'], timestamp: 3 }, { type: 'stop', city_slug: 'prague', stop_id: 'U713Z1P', stop_name: 'Strašnická', timestamp: 1 }] };
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
  const c = await b.newContext({ deviceScaleFactor: 1, colorScheme: 'dark', ...opts }); await c.addInitScript(s => localStorage.setItem('departs-preferences', JSON.stringify({ state: s, version: 0 })), state);
  const p = await c.newPage(); p.setDefaultTimeout(7000); const tap = l => kind === 'm' ? l.tap() : l.click();
  const shot = async n => { await p.waitForTimeout(700); report[`${kind}:${n}`] = await p.evaluate(grab); await p.screenshot({ path: `scratch/audit/${kind}-${n}.png` }); };
  const go = async (n, u, f) => { try { await p.goto('http://localhost:8788' + u); await p.waitForTimeout(2600); if (f) await f(); await shot(n); } catch (e) { console.log('FAIL', kind, n, String(e).split('\n')[0].slice(0, 90)); report[`${kind}:${n}`] = 'FAIL'; } };
  const grabber = async () => { if (kind === 'm') { await p.getByTestId('home-sheet-grabber').click(); await p.waitForTimeout(600); } };
  const trip = async () => { await tap(p.locator('[role=button][data-testid^=departure-item-]').first()); await p.waitForTimeout(2400); };
  await go('home', '/prague', grabber);
  await go('board', '/prague/stop/U713Z1P');
  await go('station', '/prague/stop/U142-1');
  await go('expanded', '/prague/stop/U142-1', async () => tap(p.locator('button[aria-expanded=false]').filter({ hasText: /^\+\d+/ }).first()));
  await go('trip', '/prague/stop/U142-1', trip);
  await go('mytrip', '/prague/stop/U142-1', async () => { await trip(); await tap(p.locator('button').filter({ hasText: /Idem týmto|taking this trip/ }).first()); });
  await go('ride', '/prague/stop/U142-1', async () => { await trip(); await tap(p.locator('button').filter({ hasText: /Idem týmto|taking this trip/ }).first()); await p.waitForTimeout(1000); await tap(p.locator('button').filter({ hasText: /Idem týmto|taking this trip/ }).last()); await p.waitForTimeout(1200); });
  await go('fav', '/prague/favorites');
  await go('stats', '/prague/stats');
  await go('list', '/prague/stats', async () => tap(p.locator('button').filter({ hasText: /Zoznam vozidiel|Vehicle List/ }).first()));
  await go('settings', '/prague', async () => tap(p.getByTestId('map-settings-btn').first()));
  await go('alerts', '/prague', async () => { if (kind === 'm') { await grabber(); await p.getByTestId('home-alerts-row').evaluate(e => e.click()); } else await p.getByTestId('map-alerts-btn').click(); });
  await go('search', '/prague', async () => { if (kind === 'm') await tap(p.getByTestId('search-trigger')); else await p.locator('input').first().click(); });
  await go('feedback', '/prague', async () => { await tap(p.getByTestId('map-settings-btn').first()); await p.waitForTimeout(900); await tap(p.locator('button').filter({ hasText: /Odoslať spätnú|Send Feedback/ }).first()); await p.waitForTimeout(900); });
  await go('mcp', '/prague', async () => { await tap(p.getByTestId('map-settings-btn').first()); await p.waitForTimeout(900); await tap(p.locator('button').filter({ hasText: /AI [Ii]ntegr/ }).first()); await p.waitForTimeout(900); });
  await c.close();
};
await run('m', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await run('d', { viewport: { width: 1280, height: 860 } });
await b.close();
writeFileSync('scratch/audit/report.json', JSON.stringify(report));
const off = { text: new Map(), radius: new Map(), heights: new Map() };
const add = (m, k, n, ex) => { const v = m.get(k) ?? { n: new Set(), ex: new Set() }; v.n.add(n); ex.forEach(x => v.ex.add(x)); m.set(k, v); };
for (const [n, r] of Object.entries(report)) { if (r === 'FAIL') continue; for (const [k, ex] of Object.entries(r.text)) if (!SIZES.has(k)) add(off.text, k, n, ex); for (const [k, ex] of Object.entries(r.radius)) if (!RADII.has(k)) add(off.radius, k, n, ex); for (const [k, ex] of Object.entries(r.heights)) if (+k < 28) add(off.heights, k, n, ex); }
for (const [t, m] of Object.entries(off)) { console.log('== ' + t); for (const [k, v] of [...m].sort()) console.log(k.padEnd(12), [...v.n].slice(0, 4).join(',').padEnd(44), [...v.ex].slice(0, 3).join(' | ').slice(0, 60)); }
