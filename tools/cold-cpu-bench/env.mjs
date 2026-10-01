// The Workers runtime the bundle expects, in Node: fetch (recording real upstreams or replaying them
// from fixtures.json), caches.default, the FEEDBACK_STORE KV, ASSETS and the request ctx.
import fs from 'fs';
const FIX = new URL('./fixtures.json', import.meta.url);
export function installRuntime({ mode, seedCache } = {}) {
  const fixtures = fs.existsSync(FIX) ? JSON.parse(fs.readFileSync(FIX, 'utf8')) : {};
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const key = req.method + ' ' + req.url;
    if (mode === 'record') {
      if (!fixtures[key]) {
        let res; try { res = await realFetch(req.url, { method: req.method, headers: req.headers, body: req.method === 'GET' ? undefined : await req.arrayBuffer() }); } catch { res = new Response('', { status: 599 }); }
        const body = Buffer.from(await res.arrayBuffer());
        fixtures[key] = { status: res.status, headers: [...res.headers].filter(([k]) => !/encoding|length/.test(k)), body: body.toString('base64') };
      }
    }
    const f = fixtures[key];
    if (!f) return new Response('no fixture', { status: 404 });
    return new Response(f.status === 204 || f.status === 304 ? null : Buffer.from(f.body, 'base64'), { status: f.status, headers: f.headers });
  };
  const store = new Map(seedCache ? Object.entries(seedCache) : []);
  const cache = {
    async match(r) { const k = typeof r === 'string' ? r : r.url; const e = store.get(k); if (!e) return undefined; return new Response(Buffer.from(e.body, 'base64'), { status: e.status, headers: e.headers }); },
    async put(r, res) { const k = typeof r === 'string' ? r : r.url; store.set(k, { status: res.status, headers: [...res.headers], body: Buffer.from(await res.arrayBuffer()).toString('base64') }); },
    async delete(r) { return store.delete(typeof r === 'string' ? r : r.url); },
  };
  globalThis.caches = { default: cache, open: async () => cache };
  const kv = new Map();
  const env = {
    GOLEMIO_API_KEY: process.env.GOLEMIO_API_KEY || 'x', TURNSTILE_SECRET_KEY: 'x',
    DPMP_REALTIME_URL: 'https://egov.presov.sk/geodatakatalog/dpmp.csv',
    FEEDBACK_STORE: { get: async k => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v), list: async () => ({ keys: [], list_complete: true }) },
    ASSETS: { fetch: async () => new Response('asset', { status: 200 }) },
  };
  const pending = [];
  const ctx = { waitUntil: p => pending.push(p), passThroughOnException() {} };
  return { env, ctx, pending, saveFixtures: () => fs.writeFileSync(FIX, JSON.stringify(fixtures)), dumpCache: () => Object.fromEntries(store) };
}
