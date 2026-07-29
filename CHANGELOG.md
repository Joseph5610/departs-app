## [0.57.8] - 2026-07-29

### Refactored

- **Code Quality & Component Architecture Refactoring**:
  - Fixed React render body state mutation invariant in `WelcomeModal.tsx`.
  - Replaced un-reused raw elements (`<button>`, `<span>`, callout `<div>`s) across `McpPromoBanner`, `CitySelectionList`, `StatsPanel`, `SystemStatusModal`, `SettingsModal`, `SettingsFooter`, `CondensedAlertItem`, `GenericAlertCard`, `FeedExplorer`, and `McpModal` with standard Shadcn UI primitives (`<Button>`, `<Badge>`, `<Alert>`).
  - Unified copy button design system in `McpModal.tsx` (`<Button variant="outline">` with sleek `bg-foreground/5` pill, consistent height `h-7`, gap, copy icon, and emerald check feedback).
  - Fixed layout alignment bug in `LiveStatus.tsx` where the live status pill did not shift horizontally alongside `Search` when opening stats (`/stats`) or favorites (`/favorites`) sidebars (`isStatsRoute`, `isFavoritesRoute`).
  - Refined badge styling in `SettingsFooter.tsx` (`variant="outline"` with subtle `bg-foreground/5` fill) and Website link button in `SystemStatusModal.tsx` for a sleek, non-chunky appearance.
  - Fine-tuned zebra striping opacity (`dark:bg-white/[0.02]`) and subgroup expand button background (`dark:bg-white/[0.03]`) in `DepartureBoard.tsx` for smooth, cohesive visual contrast.
  - Added `getCityConfig(citySlug?: string | null)` helper in `src/config/cities.ts` to encapsulate city lookup and fallback logic in a single place. Refactored `VehicleDetail.tsx` and `StatsPanel.tsx` to use `getCityConfig(selectedCity)` instead of repeating dictionary fallback expressions.
  - Complete design overhaul of the Admin UI (`AdminLayout.tsx`, `AdminFeedback.tsx`, `AdminIndex.tsx`, `FeedExplorer.tsx`): upgraded layout to glassmorphic header bars with admin badges, unified filter tracks, refined badge tokens (`<Badge variant="outline">`), sleek list card hover states, and modernized action buttons.

## [0.57.7] - 2026-07-27

### Added

- **Unified Empty State for Alerts Modal**:
  - Replaced plain text empty state in `AlertsModal.tsx` with shadcn UI `Empty` component suite (`Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`).
  - Added a positive green `CheckCircle2` icon with emerald background/border highlights for an optimistic "all clear / no active alerts" visual state.
  - Added localized descriptive subtitles (`noAlertsDescription` & `noAlertsSearchDescription`) in Czech and English for empty feed and search-filtered empty results.

## [0.57.6] - 2026-07-27

### Fixed

- **Service Alerts Categorization**:
  - Unified buses and trolleybuses into a combined category ("Autobusy a trolejbusy" / "Buses & Trolleybuses") in `AlertsModal.tsx`.
  - Added explicit mode guessing and mapping for funiculars (`LD` / Petřín funicular, GTFS type 7) with a dedicated `CableCar` icon and category ("Lanovky" / "Funiculars"), as well as ferries (`P1`–`P8`, GTFS type 4, "Přívozy" / "Ferries").
  - Added support for Extended GTFS route types (800–899 for trolleybuses, 700–799 for buses, 1000–1099 for ferries, 1400–1499 for funiculars) in `getTransportMode`, preventing Prague & Brno alerts from falling back into the "OSTATNÍ" ("Other") or default bus category.
  - Improved transport mode matching by iterating through all line metadata items attached to an alert.

## [0.57.5] - 2026-07-27

### Fixed

- **Line Badges & Filter Buttons**:
  - Restored proper corner rounding across all `LineBadge` sizes (`LineBadge.tsx`), replacing sharp `rounded-xs` (2px) corners with proportional Tailwind radius tokens (`rounded-sm` for `sm`/`md`, `rounded-md` for `lg`, `rounded-lg` for `xl`).
  - Switched line badge borders to borderless (`border-transparent`) for dark/colored transit badges, reserving a subtle dark stroke (`border-black/15 dark:border-black/40`) strictly for light/white badges (`getContrastColor === '#000000'`).
  - Increased horizontal padding (`px-2` for `lg`, `px-1.5` for `md`) and refined deterministic character width metrics to prevent line numbers from crowding curved badge corners.
  - Aligned header AC/Klima filter button borders and corner radius (`DepartureBoardHeader.tsx`) with `LineBadge` design tokens.

## [0.57.4] - 2026-07-27

### Changed

- **Search Bar & Command Panel Redesign**:
  - Unified top search bar and dropdown into a single continuous glass command panel (`Search.tsx`, `SearchDropdown.tsx`) when active.
  - Stripped input focus ring borders from search input field so focus outlines don't clash with glassy container.
  - Redesigned search dropdown items into smooth 12px rounded pill rows (`SearchItem.tsx`) with `p-1.5` container padding.
  - Refined dropdown category headers with vibrant accent icons (`Clock`, `Star`, `Building2`) and count badges matching the `AlertsModal` design system.
  - Updated search item highlight token to standard `bg-accent`.
  - Expanded `isSidebarOpen` detection in `Search.tsx` to include `isStatsRoute` and `isFavoritesRoute`, properly centering the search bar in the remaining map viewport on desktop when Statistics or Favorites sidebars are open.
  - Inverted platform code badge styling (`bg-foreground text-background`) in `DetailPanel.tsx` header for contrast across light and dark themes.
  - Refined Light Mode typography contrast in `src/index.css` to Rich Deep Slate (`oklch(0.22 0.01 260)`).

## [0.57.3] - 2026-07-26

### Added

- **Light Mode Re-enabled & Theme Switcher**:
  - Removed temporary `forcedTheme="dark"` pin in `ThemeProvider` (`src/main.tsx`) to allow light/dark/system mode switching.
  - Switched light mode basemap from CARTO Positron to CARTO Voyager (`voyager-gl-style`) for richer map contrast, greenery, water rendering, and vehicle readability (`src/components/Map/Map.tsx`).
  - Updated Appearance theme switcher in `DisplaySection.tsx` to use the standardized `FilterButton` grid layout (`Sun`, `Moon`, `Monitor`), achieving 100% visual consistency with transit vehicle and stop filter controls.
  - Connected Sonner toast notifications to dynamic `next-themes` theme state.

## [0.57.2] - 2026-07-26

### Refactored

- **Remote MCP Server Architecture (`functions/_mcp/`)**:
  - Reorganized single 875-line `functions/mcp.ts` into a clean modular package structure inside `functions/_mcp/`.
  - Extracted MCP tool definitions (`tools.ts`), context & helper utilities (`utils.ts`), protocol router (`rpc.ts`), and individual tool handlers (`searchStops`, `getNextDepartures`, `getNearestDepartures`, etc.).
  - Reduced `functions/mcp.ts` entrypoint to a sleek 10-line Cloudflare Pages Function delegate while preserving 100% logic and API contract compatibility.

## [0.57.1] - 2026-07-26

### Fixed

- **Glass Utility Rendering on Firefox & Low-End Devices**:
  - Added `@supports (-moz-appearance: none)` Firefox targeting in `@utility glassy` to handle Gecko Bug 1746885 (Firefox ignoring `backdrop-filter` over WebGL `<canvas>`).
  - Increased base glass opacity to 90% (`--glass-bg`) and high-contrast fallback to 96% (`--glass-fallback`).
- **MCP Modal Copy Toast Messages**:
  - Fixed copy toast messages in `McpModal` when copying the Claude CLI command or Cursor/Windsurf JSON config (previously erroneously showed "MCP Endpoint URL copied to clipboard!"). Now shows "Command copied to clipboard!" and "Configuration JSON copied to clipboard!".

## [0.57.0] - 2026-07-26

### Added

- **Native Remote MCP Server (`/mcp`)**:
  - Implemented a zero-dependency Remote Model Context Protocol (MCP 2024-11-05) Server at `https://departs.app/mcp` on Cloudflare Pages Functions (`functions/mcp.ts`).
  - Added support for SSE (`text/event-stream`) and JSON-RPC 2.0 (`initialize`, `ping`, `tools/list`, `tools/call`).
  - Exposed 5 transit tools reusing 100% of internal adapter logic, caching, and normalizers: `search_stops`, `get_next_departures`, `get_realtime_vehicles`, `get_service_alerts`, `get_vehicle_detail`.
  - Added `.well-known/mcp.json` metadata specification for discovery by Claude Code, Cursor, Windsurf, Smithery, and Glama.
  - Documented setup instructions for Claude Code (`claude mcp add --transport sse departs https://departs.app/mcp`) and Claude Desktop (`claude_desktop_config.json`) in `README.md`.
- **Remote MCP Server (`/mcp`) Features**:
  - Implemented `get_nearest_departures` tool allowing location-based departure queries by `latitude` & `longitude`.
  - Added `route_type` filtering (`bus`, `tram`, `metro`, `train`, `trolleybus`) to both `get_nearest_departures` and `get_next_departures`.
  - Integrated 0-cost cached stop notice banners (`infotexts`) directly into departure board responses for high situational awareness.
- **Remote MCP UI Promotion & Modal**:
  - Added floating, glassmorphic dismissable banner (`McpPromoBanner.tsx`) in main map view with local storage persistence.
  - Added dedicated setup guide modal (`McpModal.tsx`) with copyable setup snippets for Claude Code, Claude Desktop, and Cursor.
  - Added permanent **AI Copilot & Remote MCP** item row in `SettingsModal` (`SettingsFooter.tsx`).
- **Removed Obsolete WebMCP Hook**:
  - Deleted experimental frontend WebMCP hook (`src/hooks/features/useWebMCP.ts`) in favor of the native Cloudflare Edge Remote MCP Server (`/mcp`).

## [0.56.7] - 2026-07-26

### Fixed

- **KORDIS RT Vehicle Filtering**:
  - Filtered out invalid vehicles from KORDIS GTFS-RT feed where `vehicle.licensePlate` starts with `dpmb` (case-insensitive) in both bulk vehicle mapping (`getCachedMappedVehicles`) and single live vehicle details (`getSingleLiveVehicle`).

## [0.56.6] - 2026-07-26

### Fixed

- **GTFS-RT Vehicle Stop Matching & Invalid Stop 404 Error Handling**:
  - Implemented multi-tier stop matching in `GtfsRtVehicleDetailEnricher.findMatchingStop()` to handle leading zero variations (`U011006Z01` vs `U11006Z1`), `centroid-` stripping, and numeric node ID matches for train platforms (e.g. Brno Hlavní nádraží), while eliminating loose `.includes()` checks to prevent false-positive stop matches.
  - Updated GTFS `DeparturesService` to validate requested stop IDs against a cached `validStopsSet` (built from `parent_child_map.json` and `stops.json`). Real stops with 0 current departures return HTTP 200 OK with empty departures, while non-existent stop IDs throw an HTTP 404 `ApiError`.
  - Suppressed redundant Sonner toast popups for HTTP 404 errors in `queryCache.onError` (`src/main.tsx`), ensuring invalid stop IDs render inline in the `ErrorState` drawer without unnecessary toast alerts.
- **GTFS Alert HTML Stripping & KORDIS Header Extraction**:
  - Implemented `cleanAlertText` utility in `BaseGtfsAlertsMapper` to strip HTML tags (`<p>`, `<div>`, `<span>`, etc.) from GTFS-RT alerts while converting `<br>`, block tags, `\t`, and carriage returns into clean line breaks (`\n`).
  - Added KORDIS-specific header extraction in `KordisAlertsMapper.parseContent()` to extract the first line of alert description as the main title, falling back to `headerText` if description is missing.
  - Added `whitespace-pre-line` formatting to `GenericAlertCard` and `CondensedAlertItem` titles & descriptions to render line breaks cleanly.
- **GTFS Real-Time Vehicle Cache for Departures**:
  - Fixed `DeparturesService.getRealtimeVehiclesCache()` to invoke `VehiclesService.getCachedMappedVehicles()` directly instead of `getFilteredVehicles(ctx)`, eliminating query param validation failures when `bounds` or `routeType` are not passed.

### Refactored

- **CSS & Component Performance Optimization**:
  - Cleaned up global CSS rules in `index.css` by removing universal `* { @apply border-border; }` selector cascade.
  - Added `@utility micro-label` & `@utility micro-label-widest` to `index.css` and consolidated micro-label typography across major components.
  - Replaced `framer-motion` height animations in `DisplaySection.tsx` with CSS grid property transitions (`grid-rows-[1fr]` / `grid-rows-[0fr]`).
  - Replaced GPU-heavy `transition-all` with targeted CSS property transitions across components.
  - Added `variant="search"` to `CommandGroup` in `command.tsx` and converted `<Card>` usages to native `size="none"`.

## [0.56.5] - 2026-07-19

### Added

- **Light Mode**: Implemented global light/dark mode support.
  - Added a new `theme` setting (`system`, `light`, `dark`) with a dedicated toggle in the Display Settings.
  - Added seamless dynamic switching of the MapLibre base tile layers (`positron` vs `dark_matter`) based on the active theme.
  - Removed hardcoded `.dark` HTML classes.
  - Replaced custom theme management logic with the standard `next-themes` library, wrapping the app root in `<ThemeProvider>` to robustly handle system preference, SSR-safe hydration, and component-level theme access without duplicating state in the Zustand store.

### Fixed

- Fixed ESLint unused variable warnings across backend adapters (`DukAdapter.ts`, `VehiclesService.ts`, `GtfsAdapter.ts`) and frontend hooks (`useSelectedVehicle.ts`), enforcing strict zero-warning builds.
- **Code Review**: Production-level review of all staged changes resolved the following issues:
  - `DisplaySection.tsx`: Removed 3 unused icon imports (`Sun`, `Moon`, `Laptop`) and 2 unused store bindings (`theme`, `setTheme`) left from incomplete light mode UI scaffold — restoring zero TS/lint errors.
  - `DukAdapter.ts`, `GtfsAdapter.ts`: Replaced `void ctx` suppression with proper `_ctx` underscore prefix convention for interface-required but unused parameters.
  - `eslint.config.js`: Added `argsIgnorePattern: "^_"` to `@typescript-eslint/no-unused-vars` rule, enabling the standard underscore prefix convention for intentionally unused parameters.
  - `statsAggregator.ts`: Renamed all snake_case local mutable variables to camelCase (`lowFloorCount`, `airConditionedCount`, etc.) — snake_case is reserved for the return object keys which map to `AppCityStats` interface (JSON-style API).
  - `useVehicleTypeLabel.ts`: Memoized the `typeMap` Record via `useMemo` and wrapped the returned function in `useCallback` to prevent rebuilding the entire translation map on every call-site invocation.
  - `MostDelayedCard.tsx`: Replaced `key={i}` index-based list keys with stable composite keys (`${v.gtfs_trip_id}-${v.vehicle_id}`) to prevent React reconciliation bugs when sort order changes.
  - `StatsPanel.tsx`: Removed leftover development comment `// DetailPanel removed from imports`.

## [0.56.3] - 2026-07-19

### Fixed

- Fixed map layer ID for vehicle selection pulse effect (`useMapInterface.ts` -> `vehicle-selected-pulse`).
- Removed confusing registration number inference logic from Golemio `VehiclesMapper.ts` as it's no longer necessary.

# Changelog

## [0.56.2] - 2026-07-18

### Changed

- **Stats UI Refactoring**: Decomposed the monolithic `StatsPanel.tsx` into single-responsibility, highly-modular card components (`PunctualityCard`, `MovementStateCard`, etc.) for improved maintainability.
- **Shared Analytics Engine**: Extracted the mathematical aggregation logic into a shared `statsAggregator.ts` utility. Both the frontend and backend adapters (Golemio, GTFS, DUK) now use this exact identical function, ensuring perfect mathematical consistency between client-side screen stats and backend network-wide statistics.
- **Prague Realtime States**: Discovered and mapped hidden "pre-departure" states (`before_track`, `before_track_delayed`) and "off-track" states in the Golemio API.
- **Off Track Visualization**: Separated "Off Track" deviations into their own standalone state category in the Movement State chart (amber colored).
- **Translations**: Extracted translation of vehicle types into a reusable `useVehicleTypeLabel` hook. Expanded CS/EN locales to include new stats fields.

## [0.56.1] - 2026-07-16

### Fixed

- **Cloudflare caching**: Outbound requests to third party APIs (like Golemio) were ignoring the configured `cf: { cacheTtl }` option due to Cloudflare Workers ignoring caching for responses without permissive origin `Cache-Control` headers. Replaced this with the explicit `caches.default` Web Cache API to forcefully cache API requests on the Cloudflare Edge and prevent rate limits under heavy refreshing.

## [0.56.0] - 2026-07-16

### Changed

- **Adapter Refactoring**: Unified the `handleRawFeed` implementation in both `GtfsAdapter` and `GolemioAdapter`.
  - Extracted dynamic feeds decoding into `core/gtfs-rt-feed.ts` and used it across `GtfsAdapter`.
  - Exposed `getRawVehicles` and `getRawFeed` methods in Golemio's `VehiclesService` and `AlertsService` to prevent duplicate implementations of backend fetches and simplify the adapter layer.

## [0.55.0] - 2026-07-16

### Changed

- **Adapter Error Handling Unification**: Systematically unified how upstream network errors are handled across all city adapters (DÚK, Golemio, GTFS, Kordis).
  - High-frequency live polling endpoints (like `VehiclesService`) now strictly return a 200 OK with `status: 'upstream_offline'` rather than throwing 502 HTTP errors. This prevents browser console and server log spam during 10-second polling intervals while still allowing the frontend UI to gracefully show an "offline" banner without wiping previous map state.
  - On-demand endpoints (like `DeparturesService`, `StopsService`, and `AlertsService`) now strictly throw a hard `ApiError(502)` if the upstream provider is unreachable. This ensures the frontend correctly triggers an error boundary in UI panels rather than silently displaying empty lists.

## [0.54.0] - 2026-07-15

### Added

- **PoC: Ústecký kraj (DÚK)**: Integrated a completely new transit region (Ústecký kraj).
  - Implemented `DukVehiclesService` to stream live vehicle positions from the `/cis/GetTraffic` endpoint.
  - Implemented `DukStopsService` using `/cis/GetStations` with dynamic two-phase centroid grouping.
  - Implemented `DukDeparturesService` using `/cis/GetStationDeparturesWCount` to populate real-time departure boards, seamlessly merging platform-specific day connections and global night connections.
  - Ensured Safari/iOS cross-browser compatibility by sanitizing non-standard date formats returned by the agency API.
  - Fixed route color parsing for DÚK line badges.
  - Disabled by default as it misses the gtfs static data

## [0.53.9] - 2026-07-14

### Changed

- **Brno Full GTFS-RT Migration**: Completely removed the legacy ArcGIS `KordisArcGisVehiclesService` from the backend adapter. Brno now exclusively uses the modern GTFS-RT feed for all real-time vehicle positions.
- **Enrichment Typing**: Refactored frontend GTFS-RT websocket enrichment to perfectly align with strict backend types. Real-time data like `is_wheelchair_accessible` is now properly nested inside `vehicle_descriptor` for vehicle objects, preventing type bleed and inline hacks.
- **Enrichment Metadata**: Added `run_number` mapping to the Kordis web socket parser so that `Course` attributes dynamically populate the run number in the UI.

### Fixed

- Fixed an exhaustive dependencies loop in `FavoritesPanel`.
- Fixed multiple typecast errors regarding `tripId` map lookups.
- Resolved Tailwind arbitrary class warnings.

## [0.53.8] - 2026-07-14

### Fixed

- Fixed missing `is_air_conditioned` and `vehicle_type` metadata on the departure board for Brno by enriching the global real-time vehicles cache.
- Made vehicle detail popover background more transparent to enhance the glassmorphism blur effect.

## [0.53.7] - 2026-07-13

### Added

- Added allowed filter options in the `CityConfig` (`vehicles` and `stops`).
- Frontend settings panel now dynamically filters available vehicle and stop types based on the selected city's configuration (e.g., removing metro and stops filter for Brno).

## [0.53.6] - 2026-07-12

### Fixed

- Performance: Fixed an O(N²) nested loop in `BaseGtfsAlertsMapper.ts` that could cause Cloudflare Worker timeouts under heavy load.
- Performance: Fixed an O(N) double-fetch in `KordisGtfsRtVehiclesService.ts` (`getCoreData` double call in `Promise.all`).
- Refactoring: Removed hardcoded `IDS JMK` operator from generic `VehicleDetailMapper.ts` and made it KORDIS-specific via `KordisVehicleDetailEnricher`.
- Refactoring: Deduplicated `ApiTripData`/`ApiMapping` interfaces into canonical `kordis/services/types.ts`.
- Cleanup: Removed dead `getSingleLiveVehicle` method from `GtfsAdapter.ts`, unused `crossFix`/`haversineDist` utils, and normalized `_city` member naming.
- Config: Tightened `knip.json` entries and removed unneeded `dist` ignores.

- Resolved "ghost vehicle" duplication bug on Brno map by deduplicating Kordis GTFS-RT entities using `api.json` static timetable.
- Fixed greyed-out train timeline UI by implementing ArcGIS-style GTFS-RT Node ID fallback logic for train stops in Kordis.

- **Brno Live Tracking (Kordis)**: Completely refactored `KordisAdapter` and `KordisVehiclesService` for strict OOP purity and high performance.
- Fixed TS compilation errors regarding `string | undefined` vs `string | null` by strictly typing state fallback initializations.
- Streamlined cache orchestration via `getCachedMappedVehicles` to prevent redundant O(N) spatial mapping sweeps on concurrent requests.
- Eliminated redundant data overwriting in Kordis Adapter (e.g. stopping dynamic real-time injections of static UI values like `route_color`).

## [0.53.4] - 2026-07-08

### Fixed

- Fixed an issue where the "Switched to City" toast would incorrectly trigger multiple times on initial map load during programmatic map movements.

## [0.53.3] - 2026-07-08

### Fixed

- **Alert Icons**: Fixed an issue where the `GenericAlertCard` would not display the correct icon for specific alert effects (e.g. exclusions), restoring parity with the icons shown in the main Alerts modal.

## [0.53.2] - 2026-07-08

### Fixed

- **City Switching**: Fixed an issue where switching to a different city via the manual switcher would not load vehicles and stops until the map was manually interacted with. The map bounds are now immediately updated upon completion of the programmatic camera flight.

## [0.53.1] - 2026-07-08

### Fixed

- **Map Sync**: Fixed an issue where the selected vehicle on the map would "snap back" to its older position when clicking out of it or closing the details panel. The map stream cache is now immediately patched with the newer geometry from the vehicle detail fetch, ensuring smooth tracking and preventing the vehicle from teleporting backward while waiting for the next global refresh cycle.

## [0.53.0] - 2026-07-07

### Added

- **UI Polishing**: Upgraded all dropdown menus (such as the header options in the DetailPanel) to use the premium `glassy` material theme. They now feature a sleek translucent backdrop blur, replacing the old, flat, solid-color design.

### Changed

- **UI Polishing**: Redesigned the metro platform indicator in the departure board to match the official PID virtual boards. Replaced the old subdued transparent badge with a prominent, high-contrast white circle featuring bold black typography, and upgraded the hover behavior to use a premium, custom `Tooltip` that accurately refers to "Tracks" (Kolej) instead of "Platforms".
- **UI Polishing**: Replaced the generic `Map` icon with the sleeker `Building2` icon in the auto-region-switcher toast notification.

### Fixed

- **UI Polishing**: Optically centered the Earth icon in the CitySwitcher component (inside the search bar). We slightly increased the width and added left padding to perfectly balance the visual weight of the heavily rounded left corner.

## [0.52.16] - 2026-07-07

### Added

- **Region Switching**: The manual city switcher button (the Earth icon) now plays a highly visible pulsing and spinning animation for 2 seconds whenever the city region changes (either manually or automatically via map panning). This provides a premium, diegetic UI cue that works perfectly on both desktop and mobile without relying solely on toast notifications.

## [0.52.15] - 2026-07-07

### Added

- **Region Switching**: Added a sleek toast notification that appears when the active city region automatically changes (e.g. "Switched to Brno") as the user pans the map across territory borders.

## [0.52.14] - 2026-07-07

### Fixed

- **UI Polishing**: Fixed a large vertical gap inside `VehicleHero` that occurred exclusively during static schedule fallbacks. Also streamlined the fallback warning banner (e.g. "Location not available") from a bulky nested card into a sleek, borderless inline layout.

## [0.52.13] - 2026-07-07

### Fixed

- **UI Polishing**: Prevented "Unknown" or "Heading to destination" text from flashing in the `VehicleHero` component while real headsign data is still being fetched from the backend. Since the fetch is near-instant, the headsign now temporarily uses a non-breaking space (invisible, but preserves physical layout height) rather than a visual skeleton, eliminating layout jumps and flickering entirely.

## [0.52.12] - 2026-07-07

### Fixed

- **API/Routing**: Fixed an issue where the static GTFS fallback for vehicles erroneously returned a fallback payload instead of a 404 response when a trip was entirely invalid for the region (e.g., when crossing city boundaries and carrying over a stale vehicle ID).
- **UI Rendering**: Resolved an issue in `VehicleDetail` where the `VehicleDetailSkeleton` (which included a hero section) would render below the actual loaded hero when the timeline was still loading, causing duplicated UI elements.

## [0.52.9] - 2026-07-06

### Changed

- **UI Styling**: Inverted the colors of the platform circle badge in `DetailPanel` and `FavoritesStopCard` to use a white background with black text, matching the PID design language.

### Fixed

- **UI Styling**: Fixed an issue where the new CSS `clip-path` fix removed the `shadow-2xl` depth effect from the vehicle cards. Restored the 3D drop shadow while still preventing Safari background bleed using `bg-clip-padding` and `transform-gpu`.

- **UI Styling**: Fixed `glassy` utility class in Tailwind CSS not utilizing defined `--glass-tint` variables, resolving an issue where the background controls blended completely into the map and were almost invisible. Also tweaked dark mode `glass-tint` for slightly better contrast.

## [0.52.1] - 2026-07-05

### Fixed

- **SEO & Sitemap**: Fixed a sitemap generation bug where Brno/Kordis stops were excluded from `/sitemap.xml` due to a manual checking fallback. Replaced it with the centralized `getAdapter(city)` factory.
- **Real-Time Tracking**: Added a modulo `24` operation to the timezone hour parsing logic in `KordisVehiclesService` to prevent off-by-one calculations during the midnight hour in runtimes returning `24` for midnight.

## [0.52.0] - 2026-07-05

### Added

- **UI & Modals**: Added a interactive `SystemStatusModal` component triggered by clicking the map's live status pill. The modal provides real-time information on network status, active region, API data providers (Golemio for Prague, Kordis for Brno), data freshness metrics, next update countdown, and an educational explanation of how the data sync works.
- **Interactivity**: Upgraded the static `LiveStatus` pill to a clickable `<button>` with visual hover/active focus rings and state transitions.

## [0.51.1] - 2026-07-05

### Changed

- **UX & Board Sorting**: Replaced the simple departure board sort toggle button with a cleaner, standard dropdown menu using a general sort icon. Added explicit options for sorting by departure time (with a clock icon) and sorting by line (with an A-Z icon).
- **Preferences**: Changed the default sorting preference on first load to be sorted by departure time rather than by line.

## [0.51.0] - 2026-07-04

### Added

- **Map & Animation**: Added high-performance smooth vehicle slide animations to transition live vehicles and selected vehicles between update intervals. The animations interpolate coordinates and bearings smoothly using a `requestAnimationFrame` loop, bypassing React rendering and directly mutating MapLibre GeoJSON sources for maximum performance.
- **Visuals**: Adjusted selected vehicle pulse indicator animation parameters (increased base radius, pulse amplitude, and base opacity) to make the selected vehicle much more prominent and easier to find on the map.

## [0.50.14] - 2026-07-04

### Fixed

- **Routing & Viewport**: Fixed a race condition where launching the app on a city path different from the persisted city selection (e.g. going to `/prague` when `brno` was previously selected) triggered an immediate viewport fly-to the old city before dynamic city data loaded. Statically defined cities are now synced to the store synchronously on mount to prevent the incorrect fly-to.

## [0.50.13] - 2026-07-03

### Added

- **Assets**: Added `favicon.ico` at the root using macOS built-in sips tool to convert `favicon.png` (64x64) and registered it in PWA cached assets in `vite.config.ts`.

## [0.50.12] - 2026-07-03

### Fixed

- **PWA**: Updated runtime caching pattern for CartoDB map resources in `vite.config.ts` to also include `tiles.json` metadata under `StaleWhileRevalidate` caching, ensuring offline availability and reducing network roundtrips during map load.

## [0.50.11] - 2026-07-03

### Fixed

- **SEO & Routing**: Resolved Google Search Console redirect and canonical URL conflicts by moving the Prague map to the root URL `/` directly instead of doing a client-side redirect. Added a static CDN-level 301 redirect from `/prague` to `/` in `public/_redirects` to consolidate search indexing.

## [0.50.10] - 2026-07-01

### Fixed

- **Core & Adapter**: Optimized timezone formatting by caching and reusing `Intl.DateTimeFormat` instances (module-level constant in `KordisVehiclesService` and in-memory Map in `api-utils.ts`). This avoids expensive V8 localization database lookups and object reinstantiation on every request/cache-refresh cycle.

## [0.50.9] - 2026-07-01

### Fixed

- **Core**: Added a default 8-second request timeout to `gtfsFetch` using `AbortController` and converted custom fetches in `KordisVehiclesService` to use it. This prevents the worker requests from hanging indefinitely ("canceled" with high wallTime) when static data server endpoints (`data.departs.app`) respond slowly.

## [0.50.8] - 2026-07-01

### Fixed

- **Departures**: Replaced dynamic parsing of `stops.json` (~1.2MB of complex data) in the departures API path with a precomputed, lightweight `parent_child_map.json` (~130KB) static file, dropping departures board cache-miss CPU execution time from ~60ms to under 1ms.

## [0.50.7] - 2026-07-01

### Fixed

- **Departures**: Increased static stop departures chunking prefix length from 3 to 4 characters (e.g., `U14` split into `U140`–`U149`), shrinking maximum JSON payload size from 4.0MB to ~670KB. This reduces JSON parsing CPU time to ~3ms, successfully avoiding the Cloudflare Workers 10ms CPU limit / 503 Service Unavailable errors on busy stops like Hlavní nádraží.

## [0.50.6] - 2026-07-01

### Fixed

- **Adapter**: Configured correct passenger air conditioning status for the newer `SOR NBG 12` buses (vozy 7102–7116) delivered in 2018.

## [0.50.5] - 2026-07-01

### Fixed

- **Adapter**: Separated `SOR NBG 12` and `Irisbus Citelis 12M CNG` registration numbers within the 7001-7044 range (7007-7012 are Citelis 12M, and the rest are SOR NBG 12).

## [0.50.4] - 2026-07-01

### Fixed

- **Departures**: Increased `vehicles_v1` Cache-Control TTL to 30 seconds (previously 10s). This resolves timing offsets between the departures list refresh (10s) and vehicle positions updates, eliminating the board flickering with zero performance overhead.

## [0.50.2] - 2026-07-01

### Added

- **Departures**: Read and map static `wheelchair_accessible` values from `GtfsDepartureTuple` in `DeparturesMapper.ts` as a fallback when real-time vehicle mapping is not yet active/available for a departure.

## [0.50.1] - 2026-07-01

### Added

- **Departures**: Mapped live vehicle properties (`is_air_conditioned`, `is_wheelchair_accessible`) from the real-time vehicle status to the GTFS departures list items in `DeparturesMapper.ts`.

## [0.50.0] - 2026-07-01

### Added

- **Adapter**: Introduced a static vehicle model type and air-conditioning status resolver for DPMB (Brno) vehicles based on known registration number ranges scraped from the BMHD database.

## [0.49.7] - 2026-07-01

### Fixed

- **Adapter**: Optimized KORDIS ArcGIS query to achieve a 45x speedup (reducing latency from 6.1s to 0.13s) by requesting only required existing database fields (removing non-existent `AC`, `FinalStopName`, and `LastStopName` fields which caused query failures), limiting response features to `resultRecordCount=1300` to drop payload size from 2.5MB to ~320KB, disabling spatial geometry return (`returnGeometry=false`), and keeping database sort logic. Resolved Cloudflare Workers CPU limit/503 errors at the root while keeping a 8.5s timeout buffer.
- **Adapter**: Completely removed redundant `all_gtfs_trip_ids` field to match clean GTFS specifications and type systems, migrating adapter matching to the standard `gtfs_trip_id` property.
- **Adapter**: Corrected `GtfsAdapter` signature parameters and resolved ESLint `no-unused-vars` and `no-explicit-any` errors in backend worker functions.
- **Adapter**: Cached the `routesByName` lookup index inside `getGtfsData` to eliminate rebuilding this object on every single incoming vehicle request.
- **Adapter**: Implemented backend-side map viewport bounding box (`bounds`) filtering for KORDIS vehicles to only return active vehicles inside the user's screen.
- **Adapter**: Populated the global `vehicles_v1` cache key on the Cloudflare Cache API during vehicle fetches, enabling the GTFS departure board to match live vehicle positions and delays for Brno stops.
- **Adapter**: Fixed a potential runtime crash when checking `arcgisData.features.length` by adding optional chaining and fallback checking when the ArcGIS API returns error payloads.
- **Adapter**: Added simulated vehicle states (`before_track` and `before_track_delayed`) in `resolveActiveTrip` to detect and display warning flags when a vehicle is still active on its previous trip or has not yet commenced its matched trip.
- **Departures**: Cached the parent-to-child stop ID index map (`parent_child_map_${city}`) in the worker's memory cache for 2 hours. This replaces instantiating `StopsService`, parsing the entire `stops.json` (300KB), and running $O(N)$ linear searches for child platforms on every single departures board request.
- **Departures**: Optimized `DeparturesMapper.ts` to perform all filtering, sorting, and slicing using numeric epoch millisecond timestamps (`rtTimestampMs`), deferring ISO string conversions strictly to the final sliced payload (150 items instead of 500+ items). This eliminates expensive repeated date parsing and allocations on the departures board request path.

## [0.49.6] - 2026-07-01

### Fixed

- **Adapter**: Fixed ESLint unused `_ctx` variable error in `KordisVehiclesService.ts`.
- **Adapter**: Fixed timezone-shifting bug in `KordisVehiclesService.ts` when resolving dates/times on UTC server runtimes.
- **Adapter**: Optimized fallback route lookup in KORDIS vehicle loop to run in O(1) time using a lookup index map.

## [0.49.5] - 2026-06-26

### Fixed

- **UI**: Fixed an issue where the back button on the vehicle detail panel would incorrectly display when opening a vehicle directly from the map or search. The `lastStopId` state is now properly cleared when the detail panel closes or when a vehicle is clicked directly on the map.

## [0.49.4] - 2026-06-23

### Added

- **Map Rendering**: Enhanced route lines rendering by showing exact route stops and start/end terminal markers directly overlaid on the path using live vehicle data `stop_times`.

## [0.49.3] - 2026-06-23

- **Dependencies**: Bumped `vite` to `8.1.0`, `@vitejs/plugin-react` to `6.0.3`, and `react`/`@types/react` to latest. Fixed `vite.config.ts` typing for `manualChunks` to support Vite 8 Rollup types.

## [0.49.2] - 2026-06-23

### Fixed

- **Config**: Removed deprecated `baseUrl` and `ignoreDeprecations` from `tsconfig.app.json` which caused build errors with newer TypeScript versions.

## [0.49.1] - 2026-06-23

### Fixed

- **Testing**: Fixed Cloudflare Worker 403 errors when fetching GTFS static data during GitHub Actions CI runs by adding a User-Agent header to Miniflare requests, bypassing Cloudflare Bot Fight Mode. Added safety checks for `res.ok` to prevent JSON parsing errors on 403 HTML pages.

## [0.49.0] - 2026-06-22

### Changed

- **Routing**: Moved `/explorer` route to `/admin/explorer`.
- **UI**: Created a new `/admin` index dashboard for admin tools.

## [0.48.8] - 2026-06-22

### Changed

- Temporarily disabled Brno in both frontend and backend configurations.
- Fixed an issue where visiting invalid city slugs in the URL (like `/random`) would attempt to fetch API endpoints instead of properly redirecting to a valid fallback city.

## [0.48.7] - 2026-06-22

### Added

- **Agent Integration**: Expanded WebMCP tools with `get_departures` (returns raw JSON of departures for AI agents to parse), `navigate_to_trip`, `set_active_city`, `toggle_map_layers`, and `open_settings`.

## [0.48.6] - 2026-06-22

### Added

- **Agent Integration**: Implemented WebMCP API (`navigator.modelContext.provideContext()`) to expose site tools (like searching or navigating to stops) natively to browser-based AI agents.

## [0.48.5] - 2026-06-22

### Added

- **SEO/Agent Discovery**: Added a `Link` response header to the homepage pointing to an `llms.txt` file for automated agent discovery (RFC 8288), making the web app more agent-friendly.

## [0.48.4] - 2026-06-21

### Changed

- **UI**: Cleaned up the Departure Board header on Desktop by grouping the "Share" and "Official Board" actions into a new Dropdown Menu (hamburger icon) to save space.

## [0.48.3] - 2026-06-15

### Changed

- **UI**: Minor fixes.

## [0.48.2] - 2026-06-14

### Performance

- **Backend**: Implemented "cache stampede" protection in `VehiclesService` by caching the ongoing Promise for GTFS-RT fetching and parsing per isolate. This prevents the Cloudflare Pages Function from exceeding its CPU time limit when multiple requests hit the backend concurrently with a cold cache.
- **Backend**: Micro-optimized time allocation inside `VehiclesMapper` by moving object instantiation outside the entity parsing loop.

## [0.48.1] - 2026-06-14

### Fixed

- **Map Interaction**: Prevented parent stations from being mutated into centroids, fixing an issue where stops were loaded with a `centroid-` prefixed URL when clicked on the map.
- **Favorites**: Fixed `FavoritesPanel` returning "No upcoming departures found" by correctly mapping child platform IDs back to their requested parent station ID when fetching departures.

## [0.48.0] - 2026-06-12

### Changed

- **Architecture**: Removed Cloudflare Flagship (FLAGS) service.
- **Performance**: Optimized Brno GTFS backend adapter to respect Cloudflare 50 subrequests limits by removing real-time delays from `/departures` endpoint loops.
- **Performance**: Added `caches.default` native caching for `/stops` GTFS adapter to prevent CPU time limit exceptions.
- **Testing**: Added Playwright API E2E testing to explicitly cover Brno GTFS adapter functionality.
- **Type Safety**: Fully typed `StopsService` and dynamic configuration for data sources.

## [0.47.2] - 2026-06-12

### Fixed

- **Type Safety**: Strictly typed GTFS-RT feed protobuf structures using native types from `gtfs-realtime-bindings`. Completely eliminated `as unknown` and `as any` type assertions across `VehiclesService.ts`, `VehicleDetailService.ts`, `DeparturesService.ts`, and `AlertsMapper.ts` ensuring a 100% strictly typed backend pipeline.
- **Linter**: Resolved all remaining `@typescript-eslint/no-explicit-any` errors in backend functions.
- **Config**: Ignored Cloudflare Worker `.wrangler` build directory in `eslint.config.js`.

## [0.47.0] - 2026-06-06

### Changed

- **Shadcn UI Unification**: Full migration of the app to use official Shadcn UI components consistently across all layers.
  - **`Empty` state**: Installed official Shadcn `empty` component. Replaced custom ad-hoc divs in `ErrorState`, `MetroNightMessage`, and `FavoritesPanel` empty state with `<Empty>` + `<EmptyHeader>` + `<EmptyMedia>` + `<EmptyTitle>` + `<EmptyDescription>` + `<EmptyContent>` composition.
  - **`Card` layout**: Replaced custom `div`-based card wrappers in `DisplaySection` (`ToggleSection`), `ErrorBoundary`, and `SettingsFooter` with `<Card>` + `<CardContent>`.
  - **`Command` search**: Installed Shadcn `command` component (cmdk). Refactored `SearchItem` to `<CommandItem>` and `SearchDropdown` to `<Command>` + `<CommandList>` + `<CommandGroup>` + `<CommandSeparator>`, providing built-in keyboard navigation and proper ARIA roles.
  - **`Label`**: Installed Shadcn `label` component. Connected Stop Labels `<Switch>` in `DisplaySection` to a proper `<Label htmlFor>` for accessibility.
  - **`Button`**: Replaced raw `<button>` elements in `SettingsFooter` (clear history, check update) with Shadcn `<Button variant="ghost">`.

## [0.46.0] - 2026-06-05

### Added

- **Path-Based Routing**: Replaced query-parameter-based entity selection with clean, path-based routing (`/stop/:id`, `/trip/:id`, and `/trip/:tripId/:vehicleId`).
- **History Support**: Integrated `wouter` for proper browser history navigation, fixing the native Android "back" gesture and enabling standard forward/back navigation between stops and vehicles.

## [0.45.0] - 2026-06-03

### Changed

- **Architectural Separation of Concerns (Phase 0)**: Extracted all data mapping and transformation logic from `*Service` classes into dedicated `*Mapper` static classes (`AlertsMapper`, `DeparturesMapper`, `StopsMapper`, `VehicleDetailMapper`). Services are now strictly responsible for orchestration, fetching, and error handling.
- **Performance Optimization**: Refactored structural grouping algorithms in `grouping.ts` (specifically `processStops`) to replace expensive O(N²) `Array.from()` nested allocations with highly efficient `Map` and `Set` mutations, reducing Garbage Collection pauses during large payload construction.
- **Error Handling**: Standardized API Error propagation. Enforced `502 Bad Gateway` status codes when the upstream provider (Golemio) fails or enforces rate limits, preventing frontend misinterpretation of missing data as generic server crashes.

### Added

- **API Documentation**: Added comprehensive JSDoc annotations to all `*Mapper` files to document GTFS bitmasks, route types, and metric conversions that were previously implicit.

## [0.44.0] - 2026-05-29

### Added

- **Multi-City Architecture**: Introduced `CityAdapter` OOP pattern to easily scale the backend for multiple transit providers.
- **Adapters**: Created `GolemioAdapter` mapping to Prague PID, and stubbed `GtfsAdapter` for future cities.
- **Dynamic Routing**: Re-routed all API endpoints through `functions/api/[city]/*`. The frontend base URL is now `/api/prague/`.

### Changed

- **Unified Alerts API**: The frontend hook `useGlobalAlerts` now makes a single request to the combined `/api/prague/alerts` endpoint instead of separate `/api/rss` and `/api/infotexts` requests, reducing HTTP roundtrips.
- **Backend Refactoring**: Removed `TRANSIT_CONFIG` from shared utilities. Hardcoded Prague assumptions (e.g., timezone `Europe/Prague`, RSS URLs) have been isolated into `golemio/config.ts` and `golemio/rss-utils.ts`.
- **Date Formatting**: Generalized `formatPragueDate` to `formatDate(date, timezone)` supporting dynamic IANA timezones.

### Removed

- **Legacy API**: Deleted deprecated flat routes (`/api/stops`, `/api/departures`, `/api/vehicles`, etc.).
- **Middleware Cleanup**: Removed duplicate root `_middleware.ts`. All security policies and CORS headers are now strictly enforced by the single canonical `/api/[city]/_middleware.ts`.

## [0.43.1] - 2026-05-27

### Changed

- **Zustand Migration Phase 4 (Zero-Context Finish)**:
  - Extracted side-effects from `geolocationStore` into headless `useGeolocation.ts` hook.
  - Refactored `viewportStore` to store primitive ID (`selectedPlaceId`) instead of full `GeocodingResult` objects, resolving data via a cache.
  - Strictly typed `MapMetadataStore` camera actions (`flyTo`, `easeTo`) using `maplibre-gl`'s `FlyToOptions` and `EaseToOptions`.
  - Cleaned up obsolete context and provider imports.

## [0.43.0] - 2026-05-27

### Changed

- **Zustand Migration Phase 3**: Refined state architecture and cleaned up global side effects.
  - Implemented map camera helper actions (`flyTo`, `easeTo`, `zoomIn`, `zoomOut`) in `MapMetadataStore` to replace direct `mapRef.current` access across components (`FavoritesStopCard`, `Search`, `MapControls`, and `useMapInterface`).
  - Deprecated legacy localStorage migration fallbacks in `PreferencesStore` in favor of clean Zustand-managed defaults.
  - Refactored `useMapInterface.ts` URL synchronization and action dispatching to use granular Zustand selectors.
  - Optimized `useMapFilters.ts` dependency tracing and memoization to prevent redundant rendering cycles in `MapLayers.tsx`.
  - Installed and configured `zustand` in `package.json` dependencies.

## [0.42.0] - 2026-05-21

### Changed

- **State Management Architecture**: Migrated the entire application state from React Context/Reducers to **Zustand**.
  - Created dedicated stores: `selectionStore.ts`, `preferencesStore.ts`, and `viewportStore.ts`.
  - Replaced manual `localStorage` synchronization in Preferences with Zustand's native `persist` middleware.
  - Implemented a **Bridge Pattern** in `src/state/contexts.ts`, allowing existing components to continue using `useSelection`, `usePreferences`, and `useViewport` hooks while pulling data from the new stores.
  - Significantly reduced boilerplate code by deleting `useSelectionReducer.ts`, `usePreferencesReducer.ts`, and `useViewportReducer.ts`.
  - Improved application performance by enabling granular state subscriptions (selectors) that eliminate unnecessary re-renders in complex UI components.
  - Simplified `MapStateProvider.tsx` by removing nested Context Providers, resulting in a cleaner and more maintainable component tree.
- **Documentation**: Updated `AGENTS.md` to reflect the new state management rules and the minimal-state architectural invariant.

## [0.41.7] - 2026-05-20

### Fixed

- **Type Safety**: Strongly typed `GolemioShapeFeature.properties` with `{ shape_dist_traveled: number }` per the Golemio OpenAPI schema, eliminating the `Record<string, unknown>` hole (Zero-Hole Policy).
- **Performance**: Memoized `actions` objects and returned context values in `useViewportReducer`, `usePreferencesReducer`, and `useSelectionReducer` using `useMemo`. This gives stable references to context consumers, preventing unnecessary re-renders across the entire app on every state change.
- **Performance**: Fixed duplicate bounds-rounding logic in `MapStateProvider.onLoad` by reusing the existing memoized `getRoundedBounds(map)` helper instead of inline duplication. Added `getRoundedBounds` to the `useCallback` dependency array.
- **Performance**: Narrowed `finalViewportValue` `useMemo` dependencies in `MapStateProvider` from the top-level `viewportContext` object reference (which changed on every render) to stable `vpState` and `vpActions` primitives.
- **Cleanup**: Removed dead `"use client"` directives from `switch.tsx`, `toggle-group.tsx`, and `scroll-area.tsx`, which are not applicable in this Vite/React PWA project.

## [0.41.6] - 2026-05-20

### Fixed

- **Search History Deduplication**: Resolved the duplicate React key console warning (`Encountered two children with the same key, 'hist-place-photon-W-724672513-0'`) for geocoded places. Added place ID normalization in `usePreferencesReducer.ts` that strips the trailing query result rank index suffix from photon geocoding IDs (`photon-[osm_type]-[osm_id]-[index]`) when hydrating and adding to the search history state. This ensures stable key generation and consolidates duplicate entries representing the same physical location across different searches.

## [0.41.5] - 2026-05-19

### Fixed

- **Map State Management**: Resolved the React warning `Cannot update a component ('MapStateProvider') while rendering a different component ('MapInner')` when clicking the Star/Favorites button. Deferred selection state clearing using a `setTimeout` macrotask inside `handleToggleFavorites` to execute safely outside React's render/reconciliation phase.

## [0.41.4] - 2026-05-19

### Changed

- **Performance Optimization**: Solved the favorite stops N+1 query problem by implementing single-request bulk fetching.
  - Adapted the backend `/api/departures` endpoint to retrieve multiple `stopId` params via array query parameters and bundle them into Golemio's native grouping format (`stopIds[]={"idx": ["platformId"]}`).
  - Normalized and associated each fetched departure back to its parent `stopId` before sorting.
  - Refactored `FavoritesPanel` on the frontend to execute a single react-query fetch for all pinned stops in the background.
  - Converted `FavoritesStopCard` into a lightweight presentational component that receives departures as props and calculates walking times cleanly without making separate queries.

## [0.41.3] - 2026-05-19

### Changed

- **UI Consistency**: Unified stop platform badges to be circular (`rounded-full`) across components. Updated the platform badge in `<FavoritesStopCard />` to use a high-fidelity, centered circular badge (`w-5 h-5 rounded-full bg-white/10 border-white/10`) to match the style of the stop platform badge inside `<DetailPanel />`.

## [0.41.2] - 2026-05-19

### Changed

- **Refactoring**: Extracted magic numbers from `useStopDistance.ts` into centralized constants (`AT_STOP_THRESHOLD_METERS` and `MAX_REASONABLE_WALKING_DISTANCE`) in `src/config/constants.ts`, and updated the walking time calculation to dynamically use the `WALKING_SPEED` constant.
- **VS Code Settings**: Configured `.vscode/settings.json` to auto-fix code via ESLint on save (`source.fixAll.eslint`) and locked the TypeScript language server (`typescript.tsdk`) to the workspace's `node_modules` version.
- **VS Code Extensions**: Expanded `.vscode/extensions.json` workspace recommendations to include `dbaeumer.vscode-eslint`, `bradlc.vscode-tailwindcss`, `ms-playwright.playwright`, and `lokalise.i18n-ally`.
- **Git Config**: Updated `.gitignore` to allow tracking and sharing of workspace `.vscode/settings.json` with the team while ensuring dependencies and local secrets remain strictly ignored.
- **DevOps**: Resolved Wrangler startup warnings by explicitly specifying `--compatibility-date=2026-03-17` in the `dev` package script.

## [0.41.1] - 2026-05-18

### Fixed

- **E2E Tests**: Resolved flaky test failures on slow GitHub Actions runners by mocking the massive `10MB+` `/api/stops` endpoint with a lightweight mock payload containing only `"Hlavní nádraží"`. This prevents CPU/network overloading of the local single-threaded `wrangler dev` server and ensures instant test execution under heavy loads.
- **E2E Tests**: Upgraded the stop element locator to be space-agnostic and use standard accessibility role selection:
  - Switched to `page.getByRole('button', { name: /Hlavní\snádraží/ })`.
  - Added support for non-breaking space matching (`\s`) to handle the raw ` ` characters returned in Golemio stop names without breaking string exact-matching.
  - Increased stop locator visibility timeout to `15000ms`.
- **E2E Page Object Model (POM)**: Completely refactored all existing specs to adhere strictly to POM principles:
  - Encapsulated close button selectors and closing methods (`close()`) inside `SettingsPage` and `AlertsPage` classes, replacing all flaky coordinate-based `page.mouse.click(10, 10)` clicks with robust accessible button clicks.
  - Encapsulated regex-based and space-agnostic stop locator selection inside `SearchPage` (`getStopSearchItem` and `selectStopByRegex`), keeping specs clean of implementation details.
  - Encapsulated empty state selectors (`emptyStateMessage`) inside `AlertsPage`.

### Optimized

- **CI/CD**: Accelerated Playwright installation time by targeting only the necessary `chromium` browser and using the lightweight headless shell `--only-shell` flag (`npx playwright install chromium --with-deps --only-shell`), reducing download sizes by over 60%.
- **CI/CD**: Boosted parallel test execution by configuring 2 concurrent workers on the CI runner (`workers: 2`), cutting execution time in half.
- **CI/CD**: Added a workflow concurrency group with `cancel-in-progress: true` in GitHub Actions to auto-cancel redundant workflow runs on push updates.
- **CI/CD**: Replaced the slow `npm ls` Playwright version check in CI with an optimized direct `package.json` parse via `jq`, reducing task initialization from several seconds to milliseconds.
- **Diagnostics**: Added automatic `screenshot: 'only-on-failure'` and `video: 'retain-on-failure'` captures in `playwright.config.ts` to aid in debugging.

## [0.41.0] - 2026-05-17

### Added

- **CI/CD**: Created a brand new **Playwright E2E testing GitHub Actions workflow** (`.github/workflows/playwright.yml`) which runs automatically on pull requests and pushes to `master`.
  - Implemented Node.js setup with automated `npm` dependency caching.
  - Implemented caching for Playwright browser binaries to significantly reduce CI execution times.
  - Configured **native process environment variable forwarding** using `CLOUDFLARE_INCLUDE_PROCESS_ENV: "true"`. This allows the local Cloudflare Pages dev server (`wrangler dev`) to directly read the runner's system environment variables (like the securely chrooted `GOLEMIO_API_KEY` secret) without needing any temporary `.dev.vars` files, inline writing scripts, or risking logs/secrets exposure.
  - Optimized pipeline execution times by removing the redundant production build step, relying on Cloudflare's native deployment previews to validate compile-time integrity on commits.
  - Configured HTML test report upload artifacts on failures to facilitate quick remote troubleshooting.
- **E2E Tests**: Fixed E2E test failures caused by Mojibake/encoding mismatch in GitHub Actions runners:
  - Replaced Czech accented text `'Hlavní nádraží'` and regex checks with **safe JavaScript Unicode escape sequences** (e.g. `"Hlavní nádraží"`), making tests completely immune to system/terminal encoding differences.
  - Added optimized CI Chromium launch flags (`--disable-dev-shm-usage`, `--no-sandbox`, `--disable-gpu`) in `playwright.config.ts` to prevent OOM/sandbox crashes and maximize speed in headless runner containers.

## [0.40.1] - 2026-05-17

### Changed

- **CI/Build**: Successfully upgraded to **ESLint 10** and **@eslint/js 10.0.1** after upgrading `typescript-eslint` to **8.59.3** which adds official support for ESLint v10. This fully resolves the peer dependency collision and unblocks CI builds.
- **CI/Build**: Configured dependency grouping in `.github/dependabot.yml` to bundle all `eslint*` and `@eslint*` updates into a single PR, preventing separate partial upgrades that cause peer dependency conflicts in the future.
- **Linter**: Cleaned up code issues flagged by the new ESLint 10 rules:
  - Fixed `preserve-caught-error` in `functions/_utils/api-utils.ts` by appending `{ cause: error }` to the abort timeout error.
  - Fixed `no-useless-assignment` in `src/utils/mapIcons.ts` by correcting unused variables `x` and `y` in the canvas drawing logic.
  - Fixed `react-hooks/set-state-in-effect` in `src/components/Modals/SettingsModal/SettingsFooter.tsx` by wrapping the synchronous state update inside a deferred `setTimeout`.

## [0.38.5] - 2026-05-13

### Changed

- **UI**: Increased touch target sizes and paddings across the departure board components (`DepartureItem`, `DepartureBoard`, `DepartureBoardHeader`) to improve accessibility and interaction on mobile devices.
- **UI**: Slightly increased font sizes and icon sizes for better legibility on mobile screens.

## [0.38.4] - 2026-05-12

### Added

- **UI**: Introduced a "Unified Context Bar" in the departure board header. Distance, walking time, and live delay statistics are now consolidated into a single, sleek glassy pill with segmented interactive areas.

## [0.38.3] - 2026-05-12

### Added

- **UI**: Implemented a modern, iconic walking time display in the header. Instead of long text, it now uses a `Footprints` icon with a compact "min" abbreviation, saving significant space while maintaining clarity.

## [0.38.2] - 2026-05-12

### Fixed

- **UI**: Restored walking time display in the Departure Board header. Previously, the walking duration was being cropped out to save space, but it has been restored to provide better user context for nearby stops.

## [0.38.1] - 2026-05-12

### Fixed

- **Map**: Fixed a bug where vehicle bearing arrows were visible even when the bearing was 0. Arrows are now correctly hidden when the bearing is 0, matching historical behavior for vehicles with unknown heading.
- **Enrichment**: Aggregate metro transfer badges for hub stations (Muzeum, Florenc) in trip timeline.

## [0.38.0] - 2026-05-12

### Added

- **Branding**: Implemented orange branding (#F29400) for substitute transit lines (starting with "X") across the entire application.
- **Backend**: Updated central color normalization logic to prioritize substitute line identification.

## [0.37.0] - 2026-05-11

### Added

- **UI**: Implemented "Stacked Cards" layout for the Departure Board.
  - Grouped multiple destinations (variants) under a single line/direction badge to save vertical space.
  - Added nested "Variant Headers" for departures ending at different stops (e.g., Metro A Skalka vs. Depo Hostivař).
  - Independent "Show more" expansion logic per destination subgroup.
- **Data**: Refactored `useDepartures` hook to support two-level hierarchical grouping (Line/Direction -> Headsign).

### Fixed

- **UI**: Increased time and delay column widths to 82px to ensure stable alignment for long delay strings.
- **UX**: Updated `DepartureBoardSkeleton` to match the new nested stacked structure.

## [0.36.8] - 2026-05-10

### Added

- **UI**: Major redesign of the Departure Board to a high-density "station-style" tabular layout.
  - Reduced header from 4 rows to 2, maximizing vertical space.
  - Replaced card-based departures with compact rows (50% height reduction).
  - Group headers now integrate line badges, direction headsigns, and platform codes.
  - Added line-color tinted backgrounds to groups for better visual separation.
  - Increased default visibility (Metro: 3, Others: 2) to reduce interaction depth.
  - Maintained full feature parity (delay deltas, catch status, tracking).

### Fixed

- **UI**: Ensured line badges show on every metro direction group for clarity.

## [0.36.7] - 2026-05-10

### Fixed

- **UI**: Fixed a sorting bug where Metro departures remained grouped by direction even when "Sort by Time" was active. Now, Metro departures are interleaved chronologically when time-based sorting is selected, providing a much better experience at transfer stations.

## [0.36.6] - 2026-05-10

### Fixed

- **API**: Added a backend fallback to extract platform numbers from Metro stop IDs (e.g., `...Z1` -> `1`). This fixes missing platform badges at terminal stations like Letňany where Golemio may omit the explicit platform code in metadata.
- **UI**: Hardened Metro detection in the departure board to ensure platform badges show up consistently for all subway lines.

## [0.36.5] - 2026-05-10

### Added

- **UI**: Enabled platform (track) display for Metro departures. This helps users navigate during service disruptions by showing exactly which track a train will arrive at.
- **UI**: Limited platform badges to only Metro and Train stops to maintain a clean interface for Trams and Buses where platform information is less critical or redundant.

## [0.36.4] - 2026-05-09

### Fixed

- **Line Filter**: Refactored the line filter logic to use the actual line metadata map for identification. This ensures that all valid lines, including substitute services (starting with 'X' like 'XC'), ferries ('P'), and funiculars ('LD'), are correctly identified and filterable.
- **Search**: Improved the line identification regex as a fallback and moved metadata computation up to the parent `Search` component for better performance and consistency.

## [0.36.3] - 2026-05-09

### Fixed

- **Type Safety**: Completed a full-stack type audit. Eliminated all `as unknown` casts, `Record<string, unknown>` holes, and unsafe type signatures. The pipeline is now 100% strictly typed from Golemio raw payloads to React components.
- **Performance**: Optimized line metadata lookups from O(N) to O(1) across the entire application using pre-computed Map lookups for both frontend search and backend enrichment.
- **Architecture**: Refactored `useDepartures` to remove impure side effects from React Query's `select` transform, moving delta calculations to a robust `useEffect` pattern.
- **Cleanup**: Extracted complex inline rendering logic in `SearchItem` into dedicated components and removed legacy code from `GenericAlertCard`.
- **Reliability**: Hardened `golemioFetch` error reporting and added strict typing to the `sync-stops.ts` build script.

## [0.36.2] - 2026-05-09

### Added

- **Error Handling**: Implemented unified error types and standardized `apiFetch` client with automatic error normalization.
- **UI**: Added error states to the "Live Status" pill, distinguishing between app-level failures and upstream (Golemio) outages.
- **Backend**: Added timeout logic (15s) to `golemioFetch` with proper 504 status reporting.

## [0.36.1] - 2026-05-09

### Fixed

- **API**: Fixed "400 Bad Request" for large stations (e.g. Můstek) by filtering stop IDs to only include active platforms (`platform_code`).
- **UI**: Restored separate grouping for Metro directions (e.g. Letňany vs Háje) in the departure board.
- **Cache**: Bumped stops cache version to `v38` to force-refresh optimized stop data.
- **Refactor**: Reverted experimental API parameters and restored the required JSON format for Golemio `stopIds[]`.

## [0.36.0] - 2026-05-05

- Reverted transit grouping logic to verified version.
- Consolidated backend handlers for performance.
- Cleaned up TypeScript types across the backend pipeline.

## [0.35.0] - 2026-05-03

- Implemented zero-any type safety.
- Aligned internal types with Golemio OpenAPI.

## [0.47.1] - 2026-06-07

### Changed

- Replaced Radix-dependent `vaul` Drawer with `@base-ui/react/dialog` `Sheet` component for mobile `DetailPanel` views.
- Fixed an interaction blocking bug where iOS Safari was preventing native focus on the Map `Search` input when a direct detail URL was loaded due to Radix `DismissableLayer` intercepting `touchstart`.
- Aligned `DetailPanel` completely with the Base UI component library architectural directive.

## [0.35.0] - 2026-05-03

- Implemented zero-any type safety.
- Aligned internal types with Golemio OpenAPI.

## [0.47.1] - 2026-06-07

### Changed

- Replaced Radix-dependent `vaul` Drawer with `@base-ui/react/dialog` `Sheet` component for mobile `DetailPanel` views.
- Fixed an interaction blocking bug where iOS Safari was preventing native focus on the Map `Search` input when a direct detail URL was loaded due to Radix `DismissableLayer` intercepting `touchstart`.
- Aligned `DetailPanel` completely with the Base UI component library architectural directive.
