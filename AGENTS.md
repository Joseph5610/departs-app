# CRITICAL CONSTRAINTS: departs-app

A real-time Prague public transport (PID) tracking PWA. Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Backend: Cloudflare Pages Functions.

## 1. ARCHITECTURAL INVARIANTS (MANDATORY)

These rules are non-negotiable. Any violation is a system-level bug.

### State Model & Contexts
- **Single Source of Truth**: `MapStateProvider` coordinates the core context.
- **ID-Only Reducers**: Reducers MUST ONLY store minimal IDs.
- **Minimal State**: Full objects or computed data MUST NEVER be stored in state; they MUST be derived in hooks.

| Context | Reducer | Purpose |
|---|---|---|
| `SelectionContext` | `useSelectionReducer` | IDs: `selectedStopId`, `selectedTripId`, `selectedVehicleId`, `isFollowing` |
| `ViewportContext` | `useViewportReducer` | Map bounds, debounced bounds, route filters |
| `PreferencesContext` | `usePreferencesReducer` | User settings, UI toggles, route type filters |

### Hook Data Flow (Strict Hierarchy)
- **Layer 1: `data/` (React Query)**: Talk to the API, own the cache. (e.g., `useVehicles`, `useDepartures`)
- **Layer 2: `derived/` (Logic)**: Merge multiple data sources into single objects. (e.g., `useSelectedVehicle`, `useMapFilters`)
- **Layer 3: `features/` (UI Glue)**: Side-effects, URL sync, camera, animations. (e.g., `useMapInterface`)
- **STRICT RULE**: Imports MUST flow strictly one-way (1 -> 2 -> 3). NEVER import upward.

### Vehicle Data Priority
`useSelectedVehicle` MUST merge sources with this priority:
1. **Detail API** (Metadata via `useVehicleDetail`)
2. **Live Stream** (Positions via `useVehicles`)
3. **Reducer State** (IDs)
*If `is_static_fallback: true` in Detail API, preserve the live position/delay from the stream.*

## 2. PERFORMANCE & MAP CONSTRAINTS

The map MUST run at 60fps. React renders are too slow for high-frequency updates.

- **Bypass React**: Visual updates to map layers (paint/layout properties) MUST bypass React state.
- **Direct Mutations**: ONLY use `map.setPaintProperty()` or `map.setLayoutProperty()` for animations.
- **Cleanup**: All `requestAnimationFrame` loops MUST have a robust cleanup mechanism.
- **Memoization**: Wrap map layer components in `React.memo` with primitive props only.
- **React Query**: Use `TRANSIT_REFRESH_MS` (10s) for refreshes and `keepPreviousData` for positions to prevent flicker.

## 3. UI & DOMAIN RULES

- **DetailPanel Abstraction**: Mobile UI (Vaul drawer) and Desktop UI (Sheet sidebar) MUST be managed by `DetailPanel`. DO NOT break this responsive switch logic.
- **GTFS Types**: `0` Tram, `1` Metro, `2` Rail, `3` Bus, `4` Ferry, `7` Funicular, `11` Trolleybus.
- **Metro Logic**: Metro departures MUST be grouped by `(line + direction)` as lines A/B/C have distinct directional identities.
- **Branding Authority**: All transit colors MUST originate from `src/config/stations.ts` (static) or backend-provided branding.
- **Safe Areas**: Use `env(safe-area-inset-*)` for all layouts to account for notches.
- **i18n**: Czech (`cs`) and English (`en`) via `react-i18next`. Translation files live in `src/i18n/locales/`.
- **Normalization**: Backend handlers in `functions/` MUST follow: Validate -> Fetch -> Normalize -> Cache.

## 4. OPERATIONAL RULES (AGENT WORKFLOW)

### Forbidden Patterns (STRICT NEGATIVES)
- **NEVER** use repetitive emojis, icons, or visual filler.
- **NEVER** modify visual design during architectural refactors unless explicitly requested.
- **NEVER** use ad-hoc utility classes for core layout; use the established design system tokens.
- **NEVER** store UI state (like drawer height) in the global selection context.

### Mandatory Protocol
1. **Tool-First Interaction**: Execute tools immediately. Keep explanation under 3 sentences unless complex.
2. **Frustration Pivot**: If the user shows frustration, switch to a "Zero-Fluff" technical-only style.
3. **Build-Centricity**: Run `npm run build` before confirming any architectural change.
4. **Versioning**: Increment `package.json` exactly once per session (Patch: Fixes, Minor: Features/Arch).

### Final Checklist
Before completing: 1. Build Integrity? 2. State Purity (ID-only)? 3. Responsive Check? 4. Data Integrity (GTFS/Colors)?

### Local Environment
- **Port:** The development server always runs on `http://localhost:8788` (Cloudflare Pages proxy). Do NOT use `5173`.
