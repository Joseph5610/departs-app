import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { extname, join } from 'node:path';
const src = readFileSync('scratch/native-redesign/renderMockup.mjs', 'utf8');
const blobs = eval('(' + src.match(/const blobs = (\{[\s\S]*?\n\});/)[1] + ')');
const root = 'scratch/native-redesign/mockup';
const runtime = 'scratch/native-redesign/assets/dc-runtime.js';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const SEL = { title: '.sc-title,.nb-title', close: '.nb-close', grab: '.grab span', sheet: '.sc-sheet,.nb-sheet,.sc-medium', group: '.group,.sc-group', field: '.field,.sc-field', segFull: '.sc-seg-fill', segSmall: '.seg-sm', listName: '.nb-name,.t-row,.t-plain,.sc-set-t', time: '.nb-time', sub: '.t-sub,.nb-line2,.sc-foot', section: '.sec-title', groupHead: '.sc-h', rowBadge: '.nb-row .lb.lg', capsule: '.nb-open', primary: '.sc-primary', chip: '.sc-chip', pill: '.nb-pill', toolbar: '.nb-bar' };
const b = await chromium.launch(); const seen = {};
for (const f of ['Main.dc.html','Half.dc.html','Full.dc.html','Board.dc.html','ContrastBoard.dc.html','MoreScreens.dc.html','SettingsFull.dc.html','TripFull.dc.html']) {
  const p = await b.newPage({ viewport: { width: 2900, height: 2400 } });
  await p.route('http://mock.test/**', async r => { const path = new URL(r.request().url()).pathname; const disk = path.startsWith('/_blob/') ? blobs[path.slice(7)] : path === '/support.js' ? runtime : join(root, path); try { await r.fulfill({ body: readFileSync(disk), contentType: types[extname(disk)] ?? 'application/octet-stream' }); } catch { await r.fulfill({ status: 404, body: '' }); } });
  await p.goto('http://mock.test/' + f); await p.waitForTimeout(2000);
  const res = await p.evaluate(SEL => Object.fromEntries(Object.entries(SEL).map(([k, s]) => [k, [...new Set([...document.querySelectorAll(s)].map(e => { const c = getComputedStyle(e), r = e.getBoundingClientRect(); return `h${Math.round(r.height)} r${c.borderTopLeftRadius} ${c.fontSize}/${c.fontWeight}`; }))]])), SEL);
  for (const [k, v] of Object.entries(res)) for (const x of v) (seen[k] ??= {})[x] = [...(seen[k][x] ?? []), f.replace('.dc.html', '')];
  await p.close();
}
await b.close();
for (const [k, v] of Object.entries(seen)) { console.log('\n' + k); for (const [x, fs] of Object.entries(v)) console.log(' ', x, '<-', fs.join(',')); }
