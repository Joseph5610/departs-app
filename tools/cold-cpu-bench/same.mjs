// Usage: node same.mjs <old.mjs> <new.mjs>  - whether two bundles answer every scenario with the same body
// (last_updated ignored), from an empty edge cache and from one the first bundle filled.
import { execFileSync } from 'child_process'; import fs from 'fs';
const sc = JSON.parse(fs.readFileSync(process.env.SCENARIOS || 'scenarios.json'));
const body = (b, p, seed) => execFileSync('node', ['--input-type=module', '-e', `
const fs=await import('fs');const {now}=JSON.parse(fs.readFileSync(process.env.CLOCK||'clock.json'));const off=now-Date.now();const R=Date;
globalThis.Date=class extends R{constructor(...a){a.length?super(...a):super(R.now()+off)}static now(){return R.now()+off}};
const {installRuntime}=await import('./env.mjs');const rt=installRuntime({mode:'replay',seedCache:${seed ? "JSON.parse(fs.readFileSync('" + seed + "'))" : 'undefined'}});
const w=(await import('${process.cwd()}/${b}')).default;const r=await w.fetch(new Request('https://departs.app${p}',{headers:{Origin:'https://departs.app'}}),rt.env,rt.ctx);
const t=await r.text();await Promise.allSettled(rt.pending);${seed ? '' : "fs.writeFileSync('/tmp/claude-same-seed.json',JSON.stringify(rt.dumpCache()));"}console.log(r.status+' '+t.replace(/"last_updated":"[^"]*"/g,''));`], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
for (const [n, p] of Object.entries(sc)) {
  const a = body(process.argv[2], p), b = body(process.argv[3], p);
  const bw = body(process.argv[3], p, '/tmp/claude-same-seed.json');
  console.log((a === b ? 'same' : 'DIFF') + ' cold, ' + (a === bw ? 'same' : 'DIFF') + ' warm-edge  ' + n + '  ' + a.length);
}
