# Local development

## Prerequisites

- **Node.js 24** or newer.
- **A Golemio API key** from [api.golemio.cz](https://api.golemio.cz/api-keys/), for Prague's realtime data.

## Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/Joseph5610/departs-app.git
   cd departs-app
   npm install
   ```

2. Create `.dev.vars` from the example and fill in your Golemio key:

   ```bash
   cp .dev.vars.example .dev.vars
   ```

   | Variable | Value |
   | -------- | ----- |
   | `GOLEMIO_API_KEY` | Your Golemio key |
   | `TURNSTILE_SECRET_KEY` | Keep the example's test key, which accepts every feedback submission |

3. Start the app:

   ```bash
   npm run dev
   ```

   Open `http://localhost:8788`. Wrangler serves the API there and proxies the frontend from Vite, with hot reload for both.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | App and API on `http://localhost:8788` |
| `npm run build` | Type-checks the frontend and builds it into `dist/` |
| `npx tsc -p functions` | Type-checks the backend |
| `npm run lint` | ESLint, including the architecture rules (import layering, domain purity) |
| `npm run test:unit` | Vitest unit tests (`*.test.ts` next to the code) |
| `npm test` | Playwright end-to-end tests against a production build on `http://localhost:8788` |
| `npm run docs:dev` | This documentation on `http://localhost:5174` |

CI runs lint, both type checks, unit tests and end-to-end tests on every push and pull request to `master`.

## Project structure

```
src/
  domain/      pure transit logic, one folder per area (departures, vehicles, rides…)
  hooks/       data/ (React Query) → derived/ (composition) → features/ (side effects)
  state/       Zustand stores: client state only
  components/  React components; shadcn primitives in components/ui
  config/      tunables and tables
  i18n/        cs, sk and en translations
functions/
  api/         Pages Functions routes (/api/*)
  _cities/     one file per city: config and wiring
  _domain/     services per network
  _feeds/      upstream clients per network
  _core/       shared infrastructure (cache, time, push)
  _workers/    the ride-push Worker's Durable Object
workers/       wrangler configs of separate Workers
public/        static assets, service worker add-ons
tests/e2e/     Playwright specs
docs/          this documentation
```

`AGENTS.md` in the repository root holds the architecture rules in full.

## Ride push locally

Ride push needs the `departs-ride-push` Worker running next to `npm run dev`:

```bash
npx wrangler dev -c workers/ride-push/wrangler.toml --port 8790 --inspector-port 9231 \
  --var API_ORIGIN:http://localhost:8788
```

It reads VAPID keys from `workers/ride-push/.dev.vars` ([how to create them](./ride-push-deployment.md#1-vapid-keys)), and `npm run dev` connects to it through Wrangler's local dev registry.

To test the whole flow, serve a build, since only a build registers the service worker that receives pushes: `npm run build && npx wrangler pages dev dist`.
