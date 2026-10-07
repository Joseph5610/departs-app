# CRITICAL CONSTRAINTS: departs-app

Real-time multi-city public transport tracking PWA (Prague PID, Brno IDS JMK, Prešov DPMP, Ústecký kraj DÚK). Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Backend: Cloudflare Pages Functions. Static GTFS-derived data (stops, routes, shapes, schedules) is built by the sibling repo `departs-data`.

## 1. ARCHITECTURAL INVARIANTS (MANDATORY)

Non-negotiable. Any violation is a system-level bug.

### State Model & Zustand Stores

- **Single Source of Truth**: Server data lives in React Query (`hooks/data/`); Zustand stores (table below) hold client state only. Never copy query data into a store.
- **Minimal State**: Stores hold the minimum: IDs, settings and raw inputs (a ride, push patches). Anything derivable is derived in hooks or selectors, never stored.
- **Zero-Context Architecture**: React Context providers are avoided. Components access global state and actions directly from modular stores using granular selectors (e.g., `s => s.value`).
- **Pure Transformations**: `useMemo`, `select`, and data transforms MUST be pure. Non-trivial transforms live as plain functions in `src/domain/`; hooks only wire stores/queries to them and wrap them in a module-level `memoizeLast`. A transform that may change nothing returns its input itself (use `mapStable` from `@/lib/memoize`), since memoized consumers key on identity.

| Store              | Key File              | Purpose                                                               |
| ------------------ | --------------------- | --------------------------------------------------------------------- |
| `SelectionStore`   | `selectionStore.ts`   | Following, line filter and highlighted trip (URL owns the IDs)        |
| `ViewportStore`    | `viewportStore.ts`    | Map bounds, line route filter, selected geocoded place                |
| `PreferencesStore` | `preferencesStore.ts` | User settings, favorites, search history (Persisted)                  |
| `GeolocationStore` | `geolocationStore.ts` | User location, focus requests, last coarse location                   |
| `MapMetadataStore` | `mapMetadataStore.ts` | Map loaded state, label layer ID, MapRef and camera actions           |
| `PWAStore`         | `pwaStore.ts`         | PWA installation and update status                                    |
| `UiStore`          | `uiStore.ts`          | Which app-level modals are open (not persisted)                       |
| `RideStore`        | `rideStore.ts`        | Active ride: trip, vehicle and exit stop sequence (Persisted)         |
| `EnrichmentStore`  | `enrichmentStore.ts`  | WebSocket push patches by trip/vehicle ID, pruned after silence TTL   |

### Hook Data Flow (Strict Hierarchy)

- **Layer 1: `data/` (React Query)**: Talk to API, own cache. (e.g., `useVehicles`, `useDepartures`)
- **Layer 2: `derived/` (Composition)**: Combine data hooks, stores and `domain/` functions into single objects; the rules themselves live in `domain/`. (e.g., `useSelectedVehicle`, `useStopSearch`)
- **Layer 3: `features/` (UI Glue)**: Side-effects, URL sync, camera, animations. (e.g., `useMapInterface`)
- **STRICT RULE**: Imports MUST flow one-way (1 -> 2 -> 3). NEVER import upward.

### Source Layout

- **`src/domain/<area>/`**: pure transit logic, one folder per area (`departures`, `vehicles`, `rides`, `realtime`, `routes`, `stops`, `alerts`, `cities`, `pointsOfSale`) plus `domain/time.ts` and `domain/delay.ts`. Functions over immutable data, no classes, no React, no stores. Code outside a folder imports only its `index.ts` (`@/domain/vehicles`); files inside an area import each other directly.
- **`src/lib/`**: app infrastructure only (API client, memoization, history and URLs, device cache, geometry, search helpers, `map/` icons and initial view). Transit rules NEVER go here.
- **No `utils/` folder.** A new helper goes into the `domain/` area it belongs to, or `lib/` if it is infrastructure.
- `domain/` MUST NOT import hooks, stores or components; hooks and components import `domain/`.
- **Components**: plain functions with typed props (`({ stop }: StopCardProps) => …`), never `React.FC`; React runtime APIs as named imports (`useMemo`, `memo`), types through the `React` namespace. No IIFEs in JSX: a branchy fragment becomes a small component.
- **File names**: React components PascalCase (`DepartureBoard.tsx`); a file built around one class PascalCase after it (`VehiclesService.ts`); everything else camelCase (`apiClient.ts`, `vehicleCache.ts`). Never kebab-case, except the generated shadcn files in `components/ui/` and route files under `functions/api/`.
- **Imports (frontend)**: `@/` alias across folders, `./` only within the same folder; never `../`. Outside `domain/`, import an area through its index (`@/domain/vehicles`), never its files. Types always come from `@/types`. ESLint enforces these, the domain purity and the hook layer order (`eslint.config.js`).
- **Components and hooks hold no transit rules.** Anything that filters, sorts, groups, counts or classifies transit data (phases, notices, line order, visibility rules) is a `domain/` function the component calls; components keep only rendering, `t()` texts and styling.
- **`src/config/`** holds tunables and tables (`ROUTE_TYPE_ORDER`, `DELAY_TIERS`, thresholds), never the functions that apply them.

### Vehicle Data Priority

`useSelectedVehicle` MUST merge sources with this priority (logic in `src/domain/vehicles/merge.ts`, covered by its tests):

1. **Detail API** (Metadata via `useVehicleDetail`)
2. **Live Stream** (Positions via `useVehicles`)
3. **Selection State** (IDs)
   _If `is_static_fallback: true` in Detail API, preserve live position/delay from stream._

## 2. PERFORMANCE & MAP CONSTRAINTS

Map MUST run at 60fps. React renders too slow for high-frequency updates.

- **Bypass React**: Visual updates to map layers (like the selected vehicle pulse) MUST bypass React state via `requestAnimationFrame` and direct map mutations.
- **Direct Mutations**: ONLY use `map.setPaintProperty()` or `map.setLayoutProperty()` for high-frequency animations.
- **Cleanup**: All `requestAnimationFrame` loops and map event listeners MUST have robust cleanup.
- **Memoization**: Wrap map layer components in `React.memo` with primitive props only.
- **React Query**: Live queries poll at the user's `refreshIntervalS` (preferences store); vehicle positions use `keepPreviousData` to prevent flicker.

## 3. UI & DOMAIN RULES

- **DetailPanel Abstraction**: Mobile (Base UI Drawer) and Desktop (Sheet sidebar) MUST be managed by `DetailPanel`. DO NOT break responsive switch logic.
- **GTFS Types**: `0` Tram, `1` Metro, `2` Rail, `3` Bus, `4` Ferry, `7` Funicular, `11` or `800` Trolleybus.
- **Metro Logic**: Metro departures MUST be grouped by `(line + direction)` — lines A/B/C have distinct directional identities.
- **Branding Authority**: Line colours come from each city's `routes.json` on the static data CDN, falling back to `routeTypeColors` in `src/config/cities.ts`; map icons from `src/lib/map/icons.ts`.
- **Time Zones**: Times are shown and compared in the city's own `timezone` (city config, mirrored from the backend `CITY_REGISTRY`), never the device's or a hard-coded zone: a board must agree with its trips' timetable times.
- **Safe Areas**: Use `env(safe-area-inset-*)` for all layouts.
- **i18n**: Czech (`cs`), Slovak (`sk`) and English (`en`) locales via `react-i18next`; every key goes into all three. Translation files in `src/i18n/locales/`.
- **Backend Layout**: `functions/api/` endpoints -> `_cities/<city>.ts` (city config + use-case wiring) -> `_domain/<network>/` services -> `_feeds/<network>/` upstream clients and config -> `_core/` shared infra (cache, time, decoding).
- **Normalization**: Backend handlers in `functions/` MUST follow: Validate -> Fetch -> Normalize -> Cache.

## 4. OPERATIONAL RULES (AGENT WORKFLOW)

### Forbidden Patterns (STRICT NEGATIVES)

- **NEVER** use raw `fetch()`. All internal API calls MUST use `apiFetch` (from `@/lib/apiClient`).
- **NEVER** use manual `localStorage` / `sessionStorage` or raw `JSON.parse` for app state persistence; use Zustand stores with `persist` middleware.
- **NEVER** use repetitive emojis, icons, or visual filler.
- **NEVER** construct ad-hoc `border-dashed` or custom empty containers; use established shadcn `Empty` primitives.
- **NEVER** modify visual design during architectural refactors unless explicitly requested.
- **NEVER** copy a class string between components or hard-code colours; use design tokens (`bg-card`, `text-muted-foreground`) and component variants. A style shared by several components becomes a variant (e.g. `Card variant="panel"`).
- **NEVER** put transient UI state (drawer height, an open dropdown) in a global store; it stays local `useState`.
- **NEVER** write a class of static members only; the module is the namespace, so export functions (ESLint `no-extraneous-class`). Classes are for state or an interface implementation.
- **NEVER** use `eslint-disable`. All TypeScript and ESLint errors MUST be solved architecturally or typing-wise. Disabling the linter is strictly forbidden.
- **NEVER** nest a linear search (`find`, `filter`, `some`, `includes`) over a large collection (stops, vehicles, departures, routes) inside a loop or `.map()`; build a `Map` index once and look up in O(1).
- **NEVER** write comments that restate the code, narrate why a change was made, or record findings and measurements. Comment ONLY where the next reader would otherwise make a wrong edit, and then in ONE line stating the constraint — not the evidence for it. JSDoc on exported symbols is fine; explanatory paragraphs inside function bodies are not.
- **NEVER** introduce a loose `const` for a tunable value. Config belongs in a config object: `src/config/` on the frontend; `_core/config.ts` for cross-network and `_feeds/<network>/config.ts` for network-specific backend values.

### Mandatory Protocol

1. **Tool-First**: Execute tools immediately, then report.
2. **Response Length (HARD LIMIT)**: Final responses MUST be under 6 sentences. No exceptions for "complex" work — complexity is a reason to write less, not more.
   - **Forbidden**: recapping what you just did step by step, restating the user's question, tables or headings unless explicitly requested, listing what you did NOT do, previewing what you are about to do, apologising or self-critiquing at length.
   - **Required**: lead with the answer or result. State caveats in one clause, not a section. If evidence is needed, show the command output, not prose about it.
   - Offer detail instead of dumping it: "want the breakdown?" beats three paragraphs.
3. **Build & Quality Integrity**: Before concluding, run `npm run build` (frontend `tsc -b` + Vite), `npx tsc -p functions` (backend), `npm run lint` and `npm run test:unit`; all must pass.
4. **Versioning**: Increment `package.json` exactly ONCE per conversational session (or logical commit), NOT repeatedly on every prompt. Group all incremental changes made during the session under a single version bump. **NOTE: This rule applies ONLY to the main `departs-app` repository.**
5. **Changelog**: Maintain a single version block in `CHANGELOG.md` for the entire session. **NOTE: This rule applies ONLY to the main `departs-app` repository.**
   - **Scope**: Record ONLY **new features** (short 1-line description), **important bug fixes**, and **important architectural changes**.
   - **Forbidden**: NEVER log internal code refactors, minor typing/lint fixes, variable renames, dev tool scripts, or transient bugs introduced and resolved within the same session.
   - **Format**: Keep descriptions concise (max 1 short sentence per entry). DO NOT use nested sub-bullet lists detailing individual files or internal functions. Group all incremental session work under a single clean version header.
6. **Scratch & Testing**: All scratch files, testing scripts, and temporary data MUST live in the `/scratch` folder at the root of the repository. This folder is git-ignored, ensuring the repository is not cluttered.

## 5. DATA PIPELINE & NORMALIZATION (BACKEND)

- **Static Data**: Stop lists (parent-station grouping, `centroid-` station nodes with `is_centroid: true`), routes, shapes and schedules are built by `departs-data`; the app and `functions/` only read them.
- **Parallel Fetching**: Fetch large independent datasets in parallel via `Promise.all` where possible.
- **O(1) Lookups**: Use `Map` or `Record` for transit metadata lookups. Sequential array search (O(N)) is FORBIDDEN.
- **Strict Typing**: All internal mapping methods must return strictly typed objects adhering to internal generic types (e.g., `AppStopFeature`, `AppVehicleFeature`).
- **Zod Validation Boundaries**: Untrusted inputs (request bodies, MCP tool arguments, KV reads, third-party API responses such as Golemio, DÚK or Turnstile) MUST be validated with Zod before use. The app's own static data from `departs-data` is cast without Zod: its build checks the contract, and parsing large files with Zod costs cold-start CPU.

## 6. TESTING

- **Unit (Vitest)**: `npm run test:unit`. `*.test.ts` next to the code under `src/` or `functions/`, node environment. Shared builders (`departure()`, `vehicle()`, `patch()`, fixed `NOW`) live in `src/test/factories.ts`.
- **What Gets Unit Tests**: logic that pairs, merges or derives transit data: enrichment and push patches, vehicle source merge, departure grouping and delay stats, route progress, time/DST handling, feed normalizers. NOT trivial utils, React components or map layers.
- **Testability First**: if logic is buried in a hook, extract it to a pure function in its `src/domain/` area (or `functions/_core` / `_domain`) and test that. Do not reach for `renderHook` or jsdom.
- **Deterministic**: never depend on the real clock; pass `NOW` in or use `vi.setSystemTime`. Mock only boundaries (`apiFetch`, time, storage); NEVER `vi.mock` the project's own modules.
- **Readable Assertions**: test names state the behaviour; explicit `toEqual`/`toMatchObject` over snapshots for small outputs. At most a one-line comment above a test, stating the domain rule it guards.
- **Must Be Able To Fail**: after writing a test, break the logic once and confirm it fails.
- **E2E (Playwright)**: `npm test`, specs in `tests/e2e/`, page objects in `tests/page-objects/`, runs against `wrangler pages dev dist` on 8788. Mock the API with `page.route`. Every new user-facing flow gets a spec.
- **CI**: `.github/workflows/build.yml` runs lint, `tsc`, unit tests and E2E on every push and PR to `master`.

## 7. LOCAL ENVIRONMENT

- **Port:** Dev server always runs on `http://localhost:8788` (Cloudflare Pages proxy). Do NOT use `5173`.

### API Endpoints & Logic Authority

- **USER IS THE SOLE AUTHORITY ON ENDPOINTS AND LOGIC.** NEVER alter, "fix", format, or restructure existing API endpoints, URL paths or remote calls. If an endpoint looks weird (like using a semicolon `;gtfsTripId=`), ASSUME IT IS CORRECT.
- **Refactors preserve behaviour.** Code may be moved, split or simplified, but what it computes stays the same; prove it with the existing tests, or compare the old and new versions on varied inputs before swapping them.
