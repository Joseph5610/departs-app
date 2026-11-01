import { __unstable__loadDesignSystem as load } from 'tailwindcss';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
const ds = await load(readFileSync('src/index.css', 'utf8'), { base: 'src', loadStylesheet: async (id, base) => { const path = id === 'tailwindcss' ? 'node_modules/tailwindcss/index.css' : id.startsWith('.') ? join(base, id) : `node_modules/${id}`; try { const p = statSync(path).isDirectory() ? join(path, 'index.css') : path; return { path: p, base: dirname(p), content: readFileSync(p, 'utf8') }; } catch { return { path, base, content: '' }; } }, loadModule: async () => ({ path: '', base: '', module: {} }) });
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(p) ? [p] : []; });
const bad = new Map();
for (const f of walk('src/components')) { const s = readFileSync(f, 'utf8'); for (const m of s.matchAll(/["'`]([^"'`]*)["'`]/g)) for (const t of m[1].split(/\s+/)) { if (!/^([a-z-]+:)*!?(text|bg|border|ring|fill|from|to|type|rounded|h|size)-[a-z]/.test(t) || t.includes('.tsx')) continue; if (!ds.candidatesToCss([t])[0]) bad.set(t, f.slice(15)); } }
console.log([...bad].slice(0, 30).map(x => x.join('  ')).join('\n') || 'none'); console.log('undefined', bad.size);
