# departs-app: rules for agents

Real-time multi-city public transport PWA (Prague PID, Brno IDS JMK, Prešov DPMP, Ústecký kraj DÚK). Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui; backend on Cloudflare Pages Functions. Static GTFS-derived data (stops, routes, shapes, schedules) is built by the sibling repo `departs-data`; the app and `functions/` only read it. The rules below are mandatory; ESLint (`eslint.config.js`) enforces the ones marked so.

## 1. Architecture

### State

- **Server data lives in React Query** (`hooks/data/`); Zustand stores hold client state only. Never copy query data into a store.
- **Minimal state**: stores hold IDs, settings and raw inputs (a ride, push patches). Anything derivable is derived in hooks or selectors.
- **No React Context**: components read stores directly with granular selectors (`s => s.value`).
- **Transient UI state** (drawer height, an open dropdown) stays local `useState`, never in a store.
- **Persistence** goes through Zustand `persist`, never manual `localStorage` / `sessionStorage` or raw `JSON.parse`.

| Store              | File                  | Holds                                                                 |
| ------------------ | --------------------- | --------------------------------------------------------------------- |
| `SelectionStore`   | `selectionStore.ts`   | Following, line filter and highlighted trip (URL owns the IDs)        |
| `ViewportStore`    | `viewportStore.ts`    | Map bounds, line route filter, selected geocoded place, floor picked on a station plan |
| `PreferencesStore` | `preferencesStore.ts` | User settings, favorites, search history (persisted)                  |
| `GeolocationStore` | `geolocationStore.ts` | User location, focus requests, last coarse location                   |
| `MapMetadataStore` | `mapMetadataStore.ts` | Map loaded state, label layer ID, MapRef and camera actions           |
| `PWAStore`         | `pwaStore.ts`         | PWA installation and update status                                    |
| `UiStore`          | `uiStore.ts`          | Which app-level modals are open                                       |
| `RideStore`        | `rideStore.ts`        | My trips (boarding stop, exit, alert lead) and a followed ride (persisted) |
| `EnrichmentStore`  | `enrichmentStore.ts`  | WebSocket push patches by trip/vehicle ID, pruned after silence TTL   |

### Hooks (one-way: 1 → 2 → 3, ESLint)

1. **`data/`**: React Query hooks that talk to the API and own the cache (`useVehicles`, `useDepartures`).
2. **`derived/`**: combine data hooks, stores and `domain/` functions into single objects (`useSelectedVehicle`, `useStopSearch`).
3. **`features/`**: side effects, URL sync, camera, animations (`useMapInterface`).

Transforms are pure. Non-trivial ones are plain functions in `src/domain/`; hooks only wire stores and queries to them, wrapped in a module-level `memoizeLast`. A transform that may change nothing returns its input itself (`mapStable` from `@/lib/memoize`), since memoized consumers key on identity.

### Source layout

- **`src/domain/<area>/`**: pure transit logic (`departures`, `vehicles`, `rides`, `realtime`, `routes`, `stops`, `alerts`, `cities`, `pointsOfSale`, `indoor`, plus `time.ts`, `delay.ts`). Functions over immutable data: no classes, React, hooks, stores or components (ESLint). Outside an area, import its `index.ts` only (`@/domain/vehicles`).
- **Components and hooks hold no transit rules.** Anything that filters, sorts, groups, counts or classifies transit data is a `domain/` function; components keep rendering, `t()` texts and styling.
- **`shared/`**: facts and rules both the app and `functions/` apply, so screen and server agree (`site.ts`: hosts, contact and VAPID public key, the one file a fork edits; `cities.ts`: each city's location, zone, timezone and features; `rides.ts`: when a vehicle left a stop, boarding grace). Imports only its own files (ESLint); the app reads it as `@shared/…`, `functions/` by relative path.
- **`src/lib/`**: infrastructure only (API client, memoization, URLs, device cache, geometry, search helpers, map icons). No transit rules. There is no `utils/` folder.
- **`src/config/`**: tunables and tables (`ROUTE_TYPE_ORDER`, `DELAY_TIERS`, thresholds), never the functions that apply them. Backend values go to `functions/_core/config.ts` (cross-network) or `_feeds/<network>/config.ts`. Never a loose `const` for a tunable.
- **`functions/`**: `api/` endpoints → `_cities/<city>.ts` (city config and wiring) → `_domain/<network>/` services → `_feeds/<network>/` upstream clients → `_core/` shared infra (cache, time, decoding). Handlers go Validate → Fetch → Normalize → Cache.
- **Imports** (ESLint): `@/` across folders, `./` within one, never `../`. App types from `@/types`, `shared/` types from `@shared/…` (`@/types` does not re-export them).
- **File names**: components PascalCase, a file built around one class PascalCase after it, everything else camelCase. Kebab-case only for generated shadcn files in `components/ui/` and routes under `functions/api/`.

### Vehicle data priority

`useSelectedVehicle` merges sources in this order (`src/domain/vehicles/merge.ts`, covered by tests): 1. Detail API (`useVehicleDetail`), 2. live stream (`useVehicles`), 3. selection state (IDs). If the detail has `is_static_fallback: true`, the live position and delay from the stream win.

## 2. Map performance

The map runs at 60 fps; React renders are too slow for high-frequency updates.

- High-frequency visuals (the selected vehicle pulse) bypass React: `requestAnimationFrame` plus `map.setPaintProperty()` / `map.setLayoutProperty()` only.
- Every `requestAnimationFrame` loop and map listener is cleaned up.
- Map layer components are `React.memo` with primitive props only.
- Live queries poll at the user's `refreshIntervalS` (preferences store); vehicle positions use `keepPreviousData`.

## 3. UI and domain rules

- **Components**: plain functions with typed props, never `React.FC`; React APIs as named imports, types through the `React` namespace. No IIFEs in JSX: a branchy fragment becomes a small component.
- **DetailPanel** manages the mobile drawer and the desktop sheet; keep its responsive switch intact.
- **Primitives**: options `Tabs` (`components/ui/tabs`), filters a `FilterChip` (a `Toggle`), grouped rows `Item variant="row"`, titles `SectionTitle`, small-caps headings `SectionHeading`, read-only facts a row or `Badge variant="info"`, a tapped badge, row or card a `Pressable`, a styled control a `Button`, an empty state shadcn `Empty`.
- **Styling** (partly ESLint): `cn` from `@/lib/cn`; corners `rounded-full|surface|nested|badge|sheet`; glass from `glassy*`; font sizes from Tailwind steps or the `index.css` scale (`text-body-sm`, `text-title`…), never pixels; design tokens (`bg-card`, `text-muted-foreground`), never hard-coded colours; a style several components share becomes a variant, never a copied class string. Layouts respect `env(safe-area-inset-*)`. No decorative emoji or icon filler.
- **Vehicle types** are `AppRouteType` (`shared/api.ts`); `departs-data` translates GTFS codes, the app never uses them.
- **Metro departures** are grouped by line + direction.
- **Line colours** come from each city's `routes.json`, falling back to `routeTypeColors` in `src/config/cities.ts`; map icons from `src/lib/map/icons.ts`.
- **Time zones**: times are shown and compared in the city's `timezone` (`shared/cities.ts`), never the device's or a hard-coded zone.
- **i18n**: every key goes into `cs`, `sk` and `en` (`src/i18n/locales/`).
- **Stops**: the app reads `stops.json` as a `StopModel` (`src/domain/stops/model.ts`), every id and alias resolving through `resolveStop`. A stop has one id (station or platform) in URLs, favourites and query keys; only `departuresRequestId` expands it for networks whose departures API knows no stations. The map gets a slim GeoJSON projection (`toMapStops`); nothing else uses GeoJSON stops.

## 4. Code rules

- API calls use `apiFetch` (`@/lib/apiClient`), never raw `fetch()`.
- Never `eslint-disable`; solve lint and type errors properly.
- No classes of static members only (ESLint); classes are for state or an interface implementation.
- Lookups over large collections (stops, vehicles, departures, routes) go through a `Map` or `Record` built once, never a `find` / `filter` / `some` / `includes` inside a loop.
- Fetch independent large datasets in parallel (`Promise.all`).
- Mappers return the app's typed shapes (`AppVehicleFeature`, `AppDeparture`).
- Untrusted input (request bodies, MCP arguments, KV reads, third-party APIs such as Golemio, DÚK or Turnstile) is validated with Zod. Static data from `departs-data` is cast without Zod: its build checks the contract.
- Comments only where the next reader would otherwise make a wrong edit, in one line stating the constraint, not the evidence. JSDoc on exports is fine; no narration of changes or findings.
- Visual design does not change during refactors unless asked.

## 5. Testing

- **Unit** (Vitest, `npm run test:unit`): `*.test.ts` next to the code, node environment; builders (`departure()`, `vehicle()`, `patch()`, `NOW`) in `src/test/factories.ts`.
- **What gets tests**: logic that pairs, merges or derives transit data (push patches, vehicle merge, departure grouping, delay stats, route progress, time/DST, feed normalizers). Not trivial utils, components or map layers. Logic buried in a hook is extracted to `domain/` (or `functions/_core`, `_domain`) and tested there; no `renderHook` or jsdom.
- **Deterministic**: never the real clock (`NOW`, `vi.setSystemTime`). Mock only boundaries (`apiFetch`, time, storage); never `vi.mock` the project's own modules.
- **Readable**: names state the behaviour; explicit `toEqual` / `toMatchObject` over snapshots; at most a one-line comment naming the rule a test guards. Break the logic once to confirm a new test can fail.
- **E2E** (Playwright, `npm test`): specs in `tests/e2e/`, page objects in `tests/page-objects/`, against `wrangler pages dev dist` on 8788, API mocked with `page.route`. Every new user-facing flow gets a spec.
- **CI** (`.github/workflows/build.yml`) runs lint, `tsc`, unit and E2E tests on every push and PR to `master`.

## 6. Workflow

- **The user is the authority on endpoints and logic.** Never alter, "fix" or restructure existing API endpoints, URL paths or remote calls; an odd one (`;gtfsTripId=`) is correct. Refactors preserve behaviour: prove it with the existing tests or by comparing old and new on varied inputs.
- **Dev server** is `http://localhost:8788` (`npm run dev`), never `5173`.
- **Before concluding**, run `npm run build`, `npx tsc -p functions`, `npm run lint` and `npm run test:unit`; all must pass.
- **Version**: bump `package.json` once per session or logical commit, and keep one matching block in `CHANGELOG.md`. Log only new features, important fixes and important architectural changes, one short sentence each; never refactors, lint fixes, renames, dev scripts or bugs made and fixed in the same session.
- **Scratch files** go to `/scratch` (git-ignored).
- **Replies** stay under 6 sentences and lead with the result. No step-by-step recap, restating the question, tables or headings unless asked, lists of what was not done, previews or long apologies. State caveats in one clause, show command output rather than prose, and offer detail instead of dumping it.
