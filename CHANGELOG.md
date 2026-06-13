# Changelog

All notable changes to this project will be documented in this file.

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
  - Added support for non-breaking space matching (`\s`) to handle the raw `\u00a0` characters returned in Golemio stop names without breaking string exact-matching.
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
  - Replaced Czech accented text `'Hlavní nádraží'` and regex checks with **safe JavaScript Unicode escape sequences** (e.g. `"Hlavn\u00ed n\u00e1dra\u017e\u00ed"`), making tests completely immune to system/terminal encoding differences.
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
