import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { extname, join } from 'node:path';
const src = readFileSync('scratch/native-redesign/renderMockup.mjs', 'utf8');
const blobs = eval('(' + src.match(/const blobs = (\{[\s\S]*?\n\});/)[1] + ')');
const root = 'scratch/native-redesign/mockup', runtime = 'scratch/native-redesign/assets/dc-runtime.js';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const b = await chromium.launch(); const out = {};
const add = (k, v, f) => { ((out[k] ??= {})[v] ??= new Set()).add(f); };
for (const f of ['Main','Half','Full','LightPeek','LightHalf','Board','BoardScrolled','SwipeReveal','SwipeArmed','ContrastHome','ContrastBoard','MoreScreens','SettingsFull','TripFull']) {
  const p = await b.newPage({ viewport: { width: 2900, height: 2400 } });
  await p.route('http://mock.test/**', async r => { const path = new URL(r.request().url()).pathname; const disk = path.startsWith('/_blob/') ? blobs[path.slice(7)] : path === '/support.js' ? runtime : join(root, path); try { await r.fulfill({ body: readFileSync(disk), contentType: types[extname(disk)] ?? 'application/octet-stream' }); } catch { await r.fulfill({ status: 404, body: '' }); } });
  await p.goto(`http://mock.test/${f}.dc.html`); await p.waitForTimeout(1800);
  const res = await p.evaluate(() => {
    const scope = [...document.querySelectorAll('.phone')].filter(x => x.querySelector('.sc-sheet,.nb-sheet,.sheet,.sc-medium'));
    const allowed = [0, 6, 10, 16, 38, 34, 22, 20, 18, 14, 13, 12, 11, 5];
    const r = { font: [], radius: [], hit: [], weight: [] };
    const name = e => (e.className?.baseVal ?? e.className ?? e.tagName).toString().split(' ')[0] || e.tagName;
    for (const ph of scope) for (const e of ph.querySelectorAll('*')) {
      const c = getComputedStyle(e), box = e.getBoundingClientRect();
      if (c.display === 'none' || box.width === 0 || box.height === 0) continue;
      const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (own && parseFloat(c.fontSize) < 11) r.font.push(`${name(e)} ${c.fontSize} "${e.textContent.trim().slice(0, 14)}"`);
      if (own && parseInt(c.fontWeight) < 400) r.weight.push(name(e));
      const rad = parseFloat(c.borderTopLeftRadius);
      if (rad > 0 && !e.matches('.mat,.tl-dot,.tl-now,.tl-rail,.sw i,.sc-chip i,.pal-row i,.grab span,.live i,.veh,.cell')) {
        const capsule = rad >= Math.min(box.width, box.height) / 2 - 1.5;
        if (!capsule && ![6, 22, 38, 34, 20].includes(rad)) r.radius.push(`${name(e)} r${rad} h${Math.round(box.height)}`);
      }
      if (e.matches('button:not(.grab),a,.nb-pill,.sc-chip,.nb-ride,.nb-toggle,.sw,.seg-sm span,.nb-filters .lb') && !e.closest('.sc-seg-fill')) {
        const before = getComputedStyle(e, '::before'); const hit = before.content !== 'none' ? Math.min(parseFloat(before.width), parseFloat(before.height)) : Math.min(box.width, box.height);
        if (hit < 44) r.hit.push(`${name(e)} ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
    }
    return r;
  });
  for (const [k, v] of Object.entries(res)) for (const x of v) add(k, x, f);
  await p.close();
}
await b.close();
for (const [k, v] of Object.entries(out)) { console.log('\n' + k); for (const [x, s] of Object.entries(v)) console.log(' ', x, '<-', [...s].join(',')); }
console.log('\ndone');
