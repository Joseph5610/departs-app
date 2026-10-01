# Cold-isolate CPU benchmark

Measures what a fresh Cloudflare isolate spends on the backend: module startup, its first request, and
warm repeats. It runs the real Pages Functions bundle's `fetch` in Node, one fresh process per sample,
against recorded upstream responses, so runs are repeatable and comparable between bundles.

Run everything from this folder. Recorded data (`fixtures.json`, `clock*.json`) is git-ignored.

```sh
# 1. Build the bundle to measure (repeat per branch you compare).
npx wrangler pages functions build --cwd ../.. --outdir tools/cold-cpu-bench/out/head

# 2. Record upstream responses once. Set GOLEMIO_API_KEY to include Prague.
node record.mjs out/head/index.js '["/api/brno/vehicles","/api/brno/vehicle-detail?tripId=…","/api/duk/vehicles"]'

# 3. Compare bodies, then CPU.
node same.mjs out/head/index.js out/branch/index.js
node bench.mjs out/branch/index.js 15
```

- `bench.mjs` prints median (p25–p75) ms for startup, first request and their sum, for an empty edge
  cache (`edge-cold`) and one another isolate already filled (`edge-warm`, the common case).
- `prof.cjs <bundle> <bundle.map> <path> <seed|-> [runs]` attributes a first request's time to source
  functions; build with `--sourcemap` for it. Its absolute numbers include profiler overhead.
- The clock is frozen at recording time (`clock.json`) so the data never ages into "offline". A fixture
  recorded later than the rest needs its own clock: `CLOCK=./clock-presov.json SCENARIOS=scenarios-presov.json`.
- Node's own `fetch`/`Request` machinery is warmed before the bundle loads, so it is not billed to it.
  Numbers are relative: this harness runs slower than the Workers runtime.
