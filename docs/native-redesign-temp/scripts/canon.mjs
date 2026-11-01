import { __unstable__loadDesignSystem as load } from 'tailwindcss';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
const css = readFileSync('src/index.css', 'utf8');
const ds = await load(css, { base: 'src', loadStylesheet: async (id, base) => { const path = id === 'tailwindcss' ? 'node_modules/tailwindcss/index.css' : id.startsWith('.') ? join(base, id) : `node_modules/${id}`; try { const p = statSync(path).isDirectory() ? join(path, 'index.css') : path; return { path: p, base: dirname(p), content: readFileSync(p, 'utf8') }; } catch { return { path, base, content: '' }; } }, loadModule: async () => ({ path: '', base: '', module: {} }) });
console.log('api', typeof ds.canonicalizeCandidates);
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
const fix = process.argv[2] === 'fix'; let n = 0;
for (const f of walk('src')) {
  let s = readFileSync(f, 'utf8'); const toks = [...new Set(s.match(/[^\s"'`{}]+/g) ?? [])].filter(t => /[-:\[(]/.test(t));
  let changed = false;
  for (const t of toks) { const [c] = ds.canonicalizeCandidates([t], { rem: 16 }); if (c && c !== t && ds.candidatesToCss([t])[0]) { n++; console.log(f.slice(4), t, '->', c); if (fix) { s = s.replace(new RegExp('(?<=[\\s"\'`])' + t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?=[\\s"\'`])', 'g'), c); changed = true; } } }
  if (changed) writeFileSync(f, s);
}
console.log('total', n);
