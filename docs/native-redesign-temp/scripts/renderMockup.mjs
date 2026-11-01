import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const root = 'scratch/native-redesign/mockup';
const runtime = 'scratch/native-redesign/assets/dc-runtime.js';
const blobs = {
  e70cefe43f47d3bd5f067afbc5826a84: 'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
  bfb99ab00ab27c1f4727d7cb42a8f1d5: 'node_modules/@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2',
  '865bbeb5ef36d05a251b1ba44071d2ea': 'scratch/native-redesign/assets/map-dark.png',
  da79a068a997b905801d8d1cb321c38c: 'scratch/native-redesign/assets/map-dark.svg',
  '2607bf352327c394b4518b5bc32746fd': 'scratch/native-redesign/assets/map-light.svg',
  aa4f2a1ef1f3ac86cf49fccf99a1efe5: 'scratch/native-redesign/assets/today-peek.png',
  f3ef48b6ab3aee9a007e5c4e39abcc8a: 'scratch/native-redesign/assets/today-board-full.png',
  '134f16a0121545969f7e6ff2d716775a': 'scratch/native-redesign/assets/today-favorites.png',
  d14364eaced296f80b43e72c28ff5e71: 'scratch/native-redesign/assets/today-settings.png',
  '66c79ec22b3af8667a9fa0e17d773955': 'scratch/native-redesign/assets/today-alerts.png',
  b74dd1a06502d152d31a363cf6c26f20: 'scratch/native-redesign/assets/today-trip.png',
  '50742bcedc7472613570e0fdac7923fe': 'scratch/native-redesign/assets/today-mytrip.png',
  '075cb62c53468b2a18705a164902e640': 'scratch/native-redesign/assets/today-search.png',
};
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const b = await chromium.launch();
const pages = process.argv.slice(2);
for (const [file, w, h] of pages.map(s => s.split(':'))) {
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log(file, 'pageerror', e.message.slice(0, 200)));
  await p.route('http://mock.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let disk = path.startsWith('/_blob/') ? blobs[path.slice(7)] : path === '/support.js' ? runtime : join(root, path);
    try { const body = await readFile(disk); await route.fulfill({ body, contentType: types[extname(disk)] ?? 'application/octet-stream' }); }
    catch { console.log('404', path); await route.fulfill({ status: 404, body: '' }); }
  });
  await p.goto('http://mock.test/' + file);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'scratch/mock-' + file.replace('.dc.html', '') + '.png' });
  await p.close();
}
await b.close();
