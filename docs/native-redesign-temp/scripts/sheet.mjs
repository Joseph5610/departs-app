import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
const b = await chromium.launch();
const files = readdirSync('scratch/audit').filter(f => f.startsWith('m-') && f.endsWith('.png'));
for (const [i, part] of [files.slice(0, 8), files.slice(8)].entries()) {
  const html = '<body style="margin:0;background:#333;display:grid;grid-template-columns:repeat(4,390px);gap:8px;padding:8px;font:14px sans-serif;color:#fff">' + part.map(f => `<div>${f}<br><img width=390 src="data:image/png;base64,${readFileSync('scratch/audit/' + f).toString('base64')}"></div>`).join('');
  const p = await b.newPage({ viewport: { width: 1600, height: 1800 }, deviceScaleFactor: 1 });
  await p.setContent(html); await p.waitForTimeout(400);
  await p.screenshot({ path: `scratch/audit/sheet-${i}.png`, fullPage: true });
}
await b.close();
