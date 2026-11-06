import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const screens = ['home','board','station','expanded','trip','mytrip','ride','fav','stats','list','settings','alerts','search','feedback','mcp'];
const img = f => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
const out = process.argv[2];
for (const [kind, w, cols] of [['m', 390, 6], ['d', 640, 2]]) {
  for (const [i, part] of [screens.slice(0, 8), screens.slice(8)].entries()) {
    const cells = part.map(n => `<div><b>${n}</b> · dark / light<div style="display:flex;gap:4px;margin-top:4px">${['dark','light'].map(s => `<img width=${w} src="${img(`scratch/audit-${s}/${kind}-${n}.png`)}">`).join('')}</div></div>`).join('');
    const p = await b.newPage({ viewport: { width: cols / 2 * (2 * w + 20) + 20, height: 1000 }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:#555;color:#fff;font:600 18px sans-serif;display:grid;grid-template-columns:repeat(${cols / 2},auto);gap:16px;padding:12px">${cells}</body>`);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${kind === 'm' ? 'mobil' : 'desktop'}-${i + 1}.png`, fullPage: true });
  }
}
await b.close();
