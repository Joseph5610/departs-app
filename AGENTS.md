# CRITICAL CONSTRAINTS: departs-app

Real-time Prague PID tracking PWA. Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Backend: Cloudflare Pages Functions.

## 1. ARCHITECTURAL INVARIANTS (MANDATORY)

Non-negotiable. Any violation is system-level bug.

### State Model & Zustand Stores
- **Single Source of Truth**: Zustand stores (`selectionStore`, `viewportStore`, `preferencesStore`) manage global state.
- **Minimal State**: Stores MUST ONLY store minimal IDs or primitive settings. Full objects/computed data MUST NEVER be stored in state; derive in hooks or use selectors.
- **Bridge Pattern**: `src/state/contexts.ts` acts as a compatibility layer. Use `useSelection()`, `usePreferences()`, `useViewport()` hooks to access stores via the legacy `{ state, actions }` shape during transition.
- **Pure Transformations**: `useMemo`, `select`, and data transforms MUST be pure.

| Store | Key File | Purpose |
|---|---|---|
| `SelectionStore` | `selectionStore.ts` | IDs: `selectedStopId`, `selectedTripId`, `selectedVehicleId`, `isFollowing` |
| `ViewportStore` | `viewportStore.ts` | Map bounds, debounced bounds, selected places |
| `PreferencesStore` | `preferencesStore.ts` | User settings, favorites, search history (Persisted) |

### Hook Data Flow (Strict Hierarchy)
- **Layer 1: `data/` (React Query)**: Talk to API, own cache. (e.g., `useVehicles`, `useDepartures`)
- **Layer 2: `derived/` (Logic)**: Merge multiple data sources into single objects. (e.g., `useSelectedVehicle`, `useMapFilters`)
- **Layer 3: `features/` (UI Glue)**: Side-effects, URL sync, camera, animations. (e.g., `useMapInterface`)
- **STRICT RULE**: Imports MUST flow one-way (1 -> 2 -> 3). NEVER import upward.

### Vehicle Data Priority
`useSelectedVehicle` MUST merge sources with this priority:
1. **Detail API** (Metadata via `useVehicleDetail`)
2. **Live Stream** (Positions via `useVehicles`)
3. **Reducer State** (IDs)
*If `is_static_fallback: true` in Detail API, preserve live position/delay from stream.*

## 2. PERFORMANCE & MAP CONSTRAINTS

Map MUST run at 60fps. React renders too slow for high-frequency updates.

- **Bypass React**: Visual updates to map layers MUST bypass React state.
- **Direct Mutations**: ONLY use `map.setPaintProperty()` or `map.setLayoutProperty()` for animations.
- **Cleanup**: All `requestAnimationFrame` loops MUST have robust cleanup.
- **Memoization**: Wrap map layer components in `React.memo` with primitive props only.
- **React Query**: Use `TRANSIT_REFRESH_MS` (10s) for refreshes and `keepPreviousData` for positions to prevent flicker.

## 3. UI & DOMAIN RULES

- **DetailPanel Abstraction**: Mobile (Vaul drawer) and Desktop (Sheet sidebar) MUST be managed by `DetailPanel`. DO NOT break responsive switch logic.
- **GTFS Types**: `0` Tram, `1` Metro, `2` Rail, `3` Bus, `4` Ferry, `7` Funicular, `11` Trolleybus.
- **Metro Logic**: Metro departures MUST be grouped by `(line + direction)` — lines A/B/C have distinct directional identities.
- **Branding Authority**: All transit colors MUST originate from `src/config/stations.ts` (static) or backend-provided branding.
- **Safe Areas**: Use `env(safe-area-inset-*)` for all layouts.
- **i18n**: Czech (`cs`) and English (`en`) via `react-i18next`. Translation files in `src/i18n/locales/`.
- **Normalization**: Backend handlers in `functions/` MUST follow: Validate -> Fetch -> Normalize -> Cache. Normalization MUST perform structural grouping server-side for frontend map layer performance.

## 4. OPERATIONAL RULES (AGENT WORKFLOW)

### Forbidden Patterns (STRICT NEGATIVES)
- **NEVER** use repetitive emojis, icons, or visual filler.
- **NEVER** modify visual design during architectural refactors unless explicitly requested.
- **NEVER** use ad-hoc utility classes for core layout; use established design system tokens.
- **NEVER** store UI state (like drawer height) in global selection context.
- **Lucide Icons**: ALWAYS use even, standardized sizes (`size={16}` for w-4, `size={20}` for w-5). Non-integer viewport scaling causes subpixel anti-aliasing blurriness. For small icons (`size <= 16`), set `strokeWidth={1.5}` to prevent muddy appearances.

### Mandatory Protocol
1. **Tool-First**: Execute tools immediately. Explanation under 3 sentences unless complex.
2. **Frustration Pivot**: If user shows frustration, switch to "Zero-Fluff" technical-only style.
3. **Build & Quality Integrity**: Run `npm run build` and ensure `tsc` and `lint` pass for BOTH frontend and backend (`functions/`) before confirming any architectural change or concluding task. `npm run build` is ONLY authority for final type validation.
4. **Versioning**: Increment `package.json` exactly once per session (Patch: Fixes, Minor: Features/Arch).
5. **Changelog**: Every version increment MUST document all changes in `CHANGELOG.md` under new version header with current date.

## 5. DATA PIPELINE & NORMALIZATION

Applies to all transit data handlers in `functions/api/`.

- **Parallel Fetching**: Large GTFS datasets (Stops/Vehicles) MUST be fetched in parallel via `Promise.all` with chunked offsets to avoid Cloudflare Worker timeouts.
- **Two-Phase Grouping**: Stop processing MUST follow two phases:
    1. **Structural**: Identify and create Parent Stations (Type 1) and Entrances (Type 2).
    2. **Logical**: Merge Regular Stops (Type 0) into Structural Parent Stations (Type 1) when present. If no Type 1 parent, group by `name + node + platform`.
- **Centroid Authority**: Centroids MUST be generated for every logical stop node. Must have `is_centroid: true` and ID prefixed with `centroid-`.
- **Enrichment Filtering**: Only features in `stops-enrichment.json` (or structural parents) returned to frontend. Administrative/technical-only markers MUST be discarded.
- **Metadata Inheritance**: When merging platform points into parent station, parent MUST inherit and aggregate all `metro_lines`, `route_color`, `is_train` flags from children.
- **O(1) Lookups**: All lookups against enrichment data, line metadata, or ID maps MUST use `Map` or `Record`. Sequential array search (O(N)) for transit metadata is FORBIDDEN (Backend & Frontend).
- **Data Priority**: Golemio API real-time/static props are primary authority. `stops-enrichment.json` is augmentation only — fill missing metadata (passing lines, name expansions) or fallbacks when API data incomplete. API-provided live props (delays, positions, platform codes) always take precedence.
- **Strict Typing (Zero-Hole Policy)**: `any`, `unknown`, or generic `Record<string, unknown>` prohibited. All interfaces MUST strictly mirror Golemio OpenAPI schema from fetch layer to UI components.

## 6. LOCAL ENVIRONMENT
- **Port:** Dev server always runs on `http://localhost:8788` (Cloudflare Pages proxy). Do NOT use `5173`.
