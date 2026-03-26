# Agent Instructions: departs-app

A real-time Prague public transport (PID) tracking PWA. Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Backend runs as Cloudflare Pages Functions proxying the Golemio PID API.

## 1. Architecture

### State Model
`MapStateProvider` coordinates three reducers via separate React contexts:

| Context | Reducer | Purpose |
|---|---|---|
| `SelectionContext` | `useSelectionReducer` | Minimal IDs: `selectedStopId`, `selectedTripId`, `selectedVehicleId`, `isFollowing` |
| `ViewportContext` | `useViewportReducer` | Map bounds, debounced bounds, route filters |
| `PreferencesContext` | `usePreferencesReducer` | User settings, UI toggles, route type filters |

**Key principle**: Store only IDs. Derive everything else.

### Hook Layers
Hooks are organized in `src/hooks/` by responsibility:

| Directory | Role | Example |
|---|---|---|
| `data/` | React Query fetchers — talk to the API, own the cache | `useVehicles`, `useDepartures`, `useStops` |
| `derived/` | Pure derivation — merge multiple data sources into a single object | `useSelectedVehicle`, `useSelectedStop`, `useMapFilters` |
| `features/` | Side-effect bridges — URL sync, camera, animations, geolocation | `useMapInterface`, `useGeolocation`, `useStopSearch` |

Data flows **one way**: `data/` → `derived/` → `features/`. Never import upward.

### Vehicle Data Merge
`useSelectedVehicle` merges three sources with this priority:
1. **Detail API** (low-frequency, full metadata via `useVehicleDetail`)
2. **Live Stream** (high-frequency positions via `useVehicles`)
3. **Reducer State** (IDs only)

If the detail API returns `is_static_fallback: true`, preserve live position/delay from the stream.

### Backend (`functions/`)
Cloudflare Pages Functions that proxy and normalize the Golemio PID API. Each route handler:
- Validates query parameters
- Calls `golemioFetch()` with the appropriate endpoint
- Normalizes the response shape (the upstream API format varies)
- Returns a consistent JSON response with caching headers

Shared utilities live in `functions/_utils/`.

## 2. UI Patterns

### Responsive Layout
- **Mobile** (`< 768px`): Bottom drawer via `vaul` with snap points. Content scrolls inside `data-vaul-no-drag` regions.
- **Desktop** (`≥ 768px`): Left sidebar `Sheet` (non-modal, no overlay, doesn't steal focus from the map).

Both are wrapped by the `DetailPanel` component which handles the responsive switch.

### Component Structure
```
components/
  Map/           # Map canvas, layers, controls, search
  DetailPanel/   # Stop departures, vehicle detail (the "drawer/sidebar")
  Modals/        # Settings, Welcome, Alerts, ErrorBoundary
  Alerts/        # Alert cards and alert-related UI
  ui/            # shadcn/ui primitives (do not edit manually)
```

### Modals
Modals are pure controlled components in `Modals/`. Triggers (map buttons, etc.) are decoupled and manage open/close via context state.

## 3. Performance

### Map Layer Rules
The map runs at 60fps. All visual updates to map layers must bypass React:
- Use `map.setPaintProperty()` / `map.setLayoutProperty()` for animations (e.g., pulse effect).
- Wrap layer components in `React.memo` with primitive props only.
- Use `requestAnimationFrame` loops for continuous animations, with proper cleanup.

### Geolocation (Inversion of Control)
`useGeolocation` never directly calls `map.flyTo()`. It receives a callback (`onFlyRequest`) from the provider, keeping all map mutations centralized in `MapStateProvider`.

### React Query
- `select` transforms run inside React Query (no extra `useMemo` needed for basic transforms).
- Use `keepPreviousData` for vehicle positions to avoid visual flicker during refetches.
- All transit data refreshes every `TRANSIT_REFRESH_MS` (10s).

## 4. Domain Rules

### Prague Transit Specifics
- Route types follow GTFS: `0` = Tram, `1` = Metro, `2` = Rail, `3` = Bus, `4` = Ferry, `7` = Funicular, `11` = Trolleybus.
- Metro departures are grouped by **line + direction** (not just line), because A/B/C lines have meaningful directional splits.
- Colors follow the official PID branding palette defined in `utils/vehicleColors.ts`.

### Safe Areas
Layouts must account for mobile notches and home indicators: use `env(safe-area-inset-*)`.

### i18n
Czech (`cs`) and English (`en`) via `react-i18next`. Translation files live in `src/i18n/locales/`.

## 5. Workflow

### Non-Interference Rule
When performing architectural refactors (hooks, contexts, types), **do not modify the visual design** of components unless explicitly asked.

### Pre-commit
Always run `npm run build` to verify type safety and build stability before committing.

### Versioning
Increment the version in `package.json` once per session:
- **Patch** (`0.26.0` → `0.26.1`): Bug fixes, minor refactors.
- **Minor** (`0.26.0` → `0.27.0`): New features or significant architectural changes.

## 6. Stability Rules
- **No Decorative Loops**: Never use repetitive emojis, icons, or long blocks of visual filler (e.g., 🚀🏁 loop).
- **Concatenation Priority**: Prioritize tool execution over explanatory text.
- **Strict Response**: If the user indicates frustration, switch to zero-fluff technical responses only.
