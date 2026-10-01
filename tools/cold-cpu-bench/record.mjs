// Usage: node record.mjs <bundle.mjs> '["/api/brno/vehicles", ...]'
// Runs each path through the bundle against the real upstreams and adds every response it fetched to
// fixtures.json (an upstream already recorded is kept), then writes clock.json so replays run at this moment.
import fs from 'fs';
import { installRuntime } from './env.mjs';
const rt = installRuntime({ mode: 'record' });
const worker = (await import(fs.realpathSync(process.argv[2]))).default;
for (const path of JSON.parse(process.argv[3])) {
  const res = await worker.fetch(new Request('https://departs.app' + path, { headers: { Origin: 'https://departs.app' } }), rt.env, rt.ctx);
  const text = await res.text(); await Promise.allSettled(rt.pending.splice(0));
  console.error(res.status, path, text.length, text.slice(0, 120).replace(/\s+/g, ' '));
}
rt.saveFixtures();
fs.writeFileSync(new URL('./clock.json', import.meta.url), JSON.stringify({ now: Date.now() }));
