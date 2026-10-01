// One cold isolate: startup, first request, then warm repeats. Prints main-thread CPU in ms.
import fs from 'fs';
const [bundle, path, seedFile, warmN] = process.argv.slice(2);
const { now } = JSON.parse(fs.readFileSync(new URL(process.env.CLOCK || './clock.json', import.meta.url)));
const offset = now - Date.now();
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(RealDate.now() + offset); } static now() { return RealDate.now() + offset; } };
const { installRuntime } = await import('./env.mjs');
const seed = seedFile && seedFile !== '-' ? JSON.parse(fs.readFileSync(seedFile, 'utf8')) : undefined;
const rt = installRuntime({ mode: 'replay', seedCache: seed });
const cpu = () => performance.now();
const call = async (worker) => {
  const res = await worker.fetch(new Request('https://departs.app' + path, { headers: { Origin: 'https://departs.app' } }), rt.env, rt.ctx);
  await res.arrayBuffer(); await Promise.allSettled(rt.pending.splice(0)); return res.status;
};
// Warm Node's own lazily-loaded web platform (undici, streams, URL) so it is not billed to the worker.
{
  const r = new Request('https://warm.example/a?b=1', { headers: { Origin: 'x' } });
  const c = new Request(r.clone()); new URL(c.url).searchParams.getAll('b');
  for (const body of ['{"a":1}', new Uint8Array([1, 2]), new ReadableStream({ start(ctl) { ctl.enqueue(new Uint8Array([1])); ctl.close(); } })]) {
    const res = new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
    const res2 = new Response(res.body, res); res2.headers.set('X', 'y'); await res2.arrayBuffer();
  }
  await (await fetch('https://warm.example/none')).text(); await new Response('{"a":1}').json(); await new Response('x').text();
  await caches.default.put('https://warm.example/c', new Response('x')); await (await caches.default.match('https://warm.example/c')).text(); await caches.default.delete('https://warm.example/c');
  new TextDecoder().decode(new Uint8Array([65])); new TextEncoder().encode('a'); crypto.randomUUID(); structuredClone({ a: 1 });
  JSON.parse(JSON.stringify({ a: [1] })); new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit' }).format(0);
  await new Promise(r => setTimeout(r, 0));
}
const c0 = cpu();
const worker = (await import(bundle)).default;
const c1 = cpu();
let session; if (process.env.PROF) { const insp = await import('node:inspector/promises'); session = new insp.Session(); session.connect(); await session.post('Profiler.enable'); await session.post('Profiler.setSamplingInterval', { interval: 50 }); await session.post('Profiler.start'); }
const status = await call(worker);
if (session) { const { profile } = await session.post('Profiler.stop'); fs.writeFileSync(process.env.PROF, JSON.stringify(profile)); }
const c2 = cpu();
const warm = [];
for (let i = 0; i < +warmN; i++) { const a = cpu(); await call(worker); warm.push(cpu() - a); }
warm.sort((a, b) => a - b);
if (process.env.DUMP_CACHE) fs.writeFileSync(process.env.DUMP_CACHE, JSON.stringify(rt.dumpCache()));
console.log(JSON.stringify({ status, startup: c1 - c0, first: c2 - c1, warm: warm.length ? warm[warm.length >> 1] : null }));
