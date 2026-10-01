// Usage: node bench.mjs <bundle.mjs> [runs]  - medians (p25-p75) per scenario, one fresh process (a cold isolate) per run.
// SCENARIOS=<file> picks another scenario list; CLOCK=<file> another frozen clock (see README).
import { execFileSync } from 'child_process';
import fs from 'fs';
const bundle = fs.realpathSync(process.argv[2]); const runs = +(process.argv[3] || 25);
const here = new URL('.', import.meta.url).pathname;
const scenarios = JSON.parse(fs.readFileSync(process.env.SCENARIOS || here + 'scenarios.json', 'utf8'));
const child = (args, env = {}) => JSON.parse(execFileSync('node', [here + 'child.mjs', bundle, ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
const fmt = a => { a.sort((x, y) => x - y); return `${q(a, .5).toFixed(2)} (${q(a, .25).toFixed(1)}–${q(a, .75).toFixed(1)})`; };
const rows = [];
for (const [name, path] of Object.entries(scenarios)) {
  for (const edge of ['edge-cold', 'edge-warm']) {
    let seed = '-';
    if (edge === 'edge-warm') { seed = `${here}.seed-${process.pid}.json`; child([path, '-', '0'], { DUMP_CACHE: seed }); }
    const r = []; for (let i = 0; i < runs; i++) r.push(child([path, seed, '5']));
    rows.push([name, edge, r[0].status, fmt(r.map(x => x.startup)), fmt(r.map(x => x.first)), fmt(r.map(x => x.startup + x.first)), fmt(r.map(x => x.warm))]);
    if (seed !== '-') fs.unlinkSync(seed);
  }
}
console.log(`bundle ${process.argv[2]} (${(fs.statSync(bundle).size / 1024).toFixed(0)}KB), ${runs} runs, CPU ms median (p25–p75)`);
console.log(['scenario', 'edge', 'st', 'startup', 'first req', 'cold total', 'warm req'].join('\t'));
for (const r of rows) console.log(r.join('\t'));
