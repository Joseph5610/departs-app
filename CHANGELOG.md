# Changelog

All notable changes to `departs.app` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.69.3] - 2026-09-12

### Security

- The site sends a Content-Security-Policy in report-only mode.
- The last known location is kept on the device rounded to about 100 m, and feedback reports no longer include the map position.
- Line colours, place search results, points of sale and the Brno live-delay stream are validated before use.

### Fixed

- Links to a stop or trip whose ID contains `%` no longer crash the app.
- Stats show "No data" for an empty view instead of `NaN%`, and punctuality shares add up to 100% when some vehicles report no delay.
- Feedback and crash reports record the open stop or vehicle instead of the line filter.
- The feedback form now shows why a message can't be sent yet, in the user's language.
- The error screen, button labels and remaining hardcoded texts are translated, and numbers and weekday names follow the selected language.
- Clicking a vehicle's direction arrow or a station icon on the map now opens it.
- A vehicle at the end of its route shows its line as travelled instead of entirely upcoming.
- Line search no longer treats stop names such as "Anděl, Budějovická" as line numbers.
- A damaged saved-settings entry on the device falls back to defaults instead of breaking the app.
- Picking the same place twice no longer duplicates it in recent searches.
- Copy buttons in the AI integration panel report when copying fails instead of always showing success.

### Changed

- Faster startup and smoother map: dialogs and the stats panel load on first use, and the map redraws vehicles only when they actually move.
- Place search waits for a pause in typing, the Brno live-delay stream pauses in background tabs, and outdated cached stop data is removed from the device.
- Transport modes are listed in one order everywhere (metro, train, tram, trolleybus, bus), and the map centres the selected vehicle exactly in the area beside the sidebar.
- Frontend and backend no longer import from each other: the frontend has its own city and stats types and stats aggregator, and the backend has its own feedback schemas.

## [0.69.2] - 2026-09-12

### Added

- MCP tools return the city timezone and current local time, and departures add local times and minutes until departure.

### Changed

- Map vehicle requests snap to map tiles, so nearby viewports share cached responses and small pans no longer refetch.
- Alerts and stop notices are polled less often to save mobile data.
- Prague stop names and headsigns are shown exactly as PID publishes them.

## [0.69.1] - 2026-09-12

### Fixed

- Vehicles no longer jump back to an older position while panning the map, since each viewport could be served a differently aged cached snapshot.

## [0.69.0] - 2026-09-11

### Changed

- Line alerts in vehicle detail are a compact expandable list instead of a swipeable carousel, showing two alerts with the rest behind "Show more".
- "Show full alert" in vehicle detail opens the alerts modal scrolled to that alert and expanded.

### Fixed

- Alert descriptions in vehicle detail no longer show a partly cut-off line under the ellipsis.
- Brno alert descriptions show their paragraphs and bullet lists instead of one run-on block with stray `. .` separators.
- PID exclusion descriptions keep their headings, bullet lists and paragraphs instead of being flattened into one line, and `&amp;` is decoded.
- Alerts no longer show an uninformative "Unknown cause" / "Other cause" label.
- GTFS-based cities send a fallback grey for vehicles on lines without a route color (e.g. Prešov depot runs) instead of an empty color that rendered black.

## [0.68.0] - 2026-09-10

### Added

- Prešov (DPMP) as the first Slovak city, with live vehicles matched from DPMP's realtime CSV export onto the static GTFS timetable.
- Slovak locale, picked automatically for Slovak-language browsers.
- The city switcher groups cities by country, listing the viewer's own country first; first-time viewers in Slovakia start in Prešov.

### Fixed

- A failed static-data fetch on a cold isolate is now retried after 5s instead of serving empty routes for two hours.
- Live vehicles, vehicle detail, departures and stats no longer lag one poll behind, because the browser was answering each poll from its HTTP cache.

## [0.67.0] - 2026-09-10

### Security

- Feedback is now rejected when `TURNSTILE_SECRET_KEY` is unset instead of falling back to Cloudflare's always-passes testing key, which silently disabled bot protection.
- Removed the KV-based feedback rate limiter, which could not hold under concurrency; request-rate limiting is enforced at the Cloudflare edge.

### Fixed

- Fixed the `get_realtime_vehicles` MCP tool returning no vehicles in either city, and no longer filtering the fleet by the map-framing bounding box, which had been discarding every suburban and regional vehicle.
- A failed or malformed stops fetch now returns a 502 instead of an opaque 500, and is no longer cached as an empty result for two hours.
- The `bounds` parameter is now validated; a malformed value returns 400 rather than silently yielding an empty vehicle collection.
- Fixed stop notices being attached to unrelated stops whose ID merely contained a related one.

### Added

- MCP tool arguments are now validated against each tool's declared input schema, rejecting out-of-range coordinates, non-positive limits and unknown tools.
- Departures requests are now bounded, both in how many stops they may name and how many platforms those expand into.

### Changed

- Cut per-request CPU on departures and vehicle detail by memoising the GTFS `Intl` date formatters instead of constructing them on every call.
- Removed the hot-path `[PERF]` timing logs, several of which did real work purely to build a message.
- Nearest-departures now fetches every stop in one wave instead of up to ten serialised round trips, and the Golemio services overlap their enrichment fetch with the upstream call.

## [0.66.0] - 2026-09-09

### Changed

- Migrated MapLibre GL JS from v5 to v6, resolving a critical (CVSS 10.0) XSS sanitizer bypass in `DOM.sanitize()` that could execute attacker-supplied attribution markup without user interaction.
- MapLibre v6 is ESM-only and resolves its worker relative to the bundle, so the worker is now bundled and registered explicitly via `setWorkerUrl` — without this the map fails to render in production builds.

### Fixed

- Fixed vehicles waiting at their origin being reported as running early, with all upcoming stop times shifted; departure status is now evaluated against the schedule before any delay is estimated.
- Cut the CPU cost of the Brno vehicle feed by replacing the 2.5MB `api.json` lookup with a compact per-trip index, resolving CPU-limit 503s on cold Worker isolates.
- Patched the remaining development-toolchain advisories (sharp, hono, js-yaml, fast-uri, qs), bringing `npm audit` to zero vulnerabilities.

## [0.65.1] - 2026-09-09

### Fixed

- Fixed intermittent 503 "Exceeded CPU Limit" errors on Brno endpoints, caused by the vehicle detail poll re-parsing the entire multi-megabyte GTFS shape chunk every 10 seconds; route geometry, trip stops and departure tuples are now memoised in size-bounded in-isolate caches.
- Prevented a single CPU-killed request from stalling every subsequent request in the same Worker isolate by bounding how long `CacheManager` will wait on another request's in-flight fetch.
- Fixed upstream fetch failures being cached as valid results for two hours, which could leave a city serving no vehicles until the cache expired.
- Split Brno route geometry into evenly sized chunks, cutting the largest shape file the backend must parse from 9.5 MB to under 200 KB.

## [0.65.0] - 2026-09-04

### Added

- Brno vehicle detail now renders precise GTFS route shapes instead of straight stop-to-stop lines, using a new external API that provides shape geometry chunked and cached for 24h.

## [0.63.4] - 2026-09-01

### Fixed

- Fixed vehicle tracking on ended trips by treating mismatched GTFS-RT live vehicles as a static fallback instead of interpolating them onto the old route.

## [0.63.3] - 2026-09-01

### Fixed

- Fixed MCP connector silent failures by correctly mapping comma-separated `stop_id` query arrays and explicitly omitting UI-only virtual map centroids from search results.
- Expose `platform` and `platform_code` correctly to the MCP tools.

## [0.63.2] - 2026-09-01

### Fixed

- Fixed 1px right border clipping issue across all ScrollArea components by introducing a 1px viewport padding.

## [0.63.1] - 2026-09-01

### Fixed

- Fixed missing backdrop-filter blur on Map overlays in production and Firefox by resolving CSS minification conflicts and native support.

## [0.63.0] - 2026-08-31

### Added

- Local delay estimation fallback for GTFS-RT vehicles based on static schedules and real-time position.

### Fixed

- Fixed critical "Worker exceeded CPU time limit" crashes in Brno caused by heavy API JSON parsing during cold starts.

## [0.62.9] - 2026-08-31

### Added

- Added visual indicator (FILTERED) to the Live status pill on the map when transit filters are active.

## [0.62.7] - 2026-08-31

### Changed

- Optimized Brno ArcGIS StreamServer connection by requesting only necessary fields (`outFields`) and adding dynamic attribute filtering support.

## [0.62.6] - 2026-08-19

### Fixed

- Fixed an issue where Cloudflare Access authorization flows (paths under `/cdn-cgi/`) were being intercepted by the PWA service worker, breaking the `/admin` login redirect.

## [0.62.5] - 2026-08-18

### Fixed

- Fixed an issue where the Kordis vehicle mapping logic incorrectly prioritized stale trips over active ones if they appeared earlier in the GTFS-RT feed.

## [0.62.4] - 2026-08-16

### Added

- Feature parity for Brno GTFS static data to extract and display `zone_id` on the vehicle timeline.

## [0.62.3] - 2026-08-16

### Fixed

- E2E tests: Correctly configure `departs-preferences` localStorage structure, preventing the Welcome Modal from blocking tests.

## [0.62.2] - 2026-08-16

### Fixed

- Made `routeShortName` line filter evaluation case-insensitive across backend APIs to fix search matching for mixed-case line names like `xS41`.

## [0.62.1] - 2026-08-15

### Fixed

- Derived `before_track` state position directly from initial stop scheduled departure in GTFS vehicle detail enricher.

## [0.62.0] - 2026-08-14

### Added

- Distinction between travelled (faded) and upcoming (solid) route line segments in vehicle detail map view.
- Vehicle travel direction arrows along active route lines.

## [0.61.0] - 2026-08-13

### Added

- Clickable stop items in vehicle schedule timeline when GTFS `stop_id` is present (such as in Brno/KORDIS).
- Bi-directional back button navigation between stop departure boards and vehicle details.

## [0.60.0] - 2026-08-13

### Changed

- Standardized API requests to `apiFetch`, migrated persistent user location/welcome state to Zustand `persist` stores, standardized shadcn `Empty` UI components, and added Zod boundary validation.

## [0.59.16] - 2026-08-11

### Fixed

- Added `before_track` status estimation for KORDIS GTFS-RT vehicles based on stationary speed and time before scheduled departure.

## [0.59.15] - 2026-08-11

### Added

- Added dynamic Points of Sale map layer and DetailPanel view for ticket machines, info centers, and offices.

## [0.59.14] - 2026-08-11

### Added

- Added togglable vehicle coloring by delay feature with green, orange, red, and purple delay threshold markers on map layers.

## [0.59.13] - 2026-08-10

### Added

- Added distinct `before_track_delayed` and `canceled` vehicle state banners and localization in `VehicleHero`.

## [0.59.12] - 2026-08-10

### Refactored

- Made `metro_lines` property optional in backend models and omitted empty `metro_lines` arrays from vehicle detail payloads.
- Streamlined live `/vehicles` Map GeoJSON stream payload by omitting unpopulated redundant properties (`trip_headsign`, `last_stop_sequence`, `run_number`).

## [0.59.11] - 2026-08-10

### Fixed

- Cleaned up redundant timetable properties from `route_geojson` point features in vehicle detail responses for Prague and Brno.

## [0.59.10] - 2026-08-10

### Removed

- Removed unused `next_stop_name` property across frontend types, backend mappers, and schemas.

## [0.59.9] - 2026-08-10

### Refactored

- Replaced redundant `is_start`, `is_end`, and `is_regular` stop point properties with a single `is_terminal` flag in vehicle detail responses and map layers.

## [0.59.8] - 2026-08-10

### Removed

- Removed redundant `is_night` field from vehicle models and backend mappers.

## [0.59.7] - 2026-08-10

### Fixed

- Fixed missing English translations for the network stats panel and monitor tabs.

## [0.59.6] - 2026-08-09

### Added

- Added strict `VehicleState` typing for vehicle tracking state.

## [0.59.5] - 2026-08-09

### Changed

- **Type Standardization**: Refactored `route_type` and `type` to use strictly standardized string slugs ('bus', 'tram', 'train', etc.) across all backend adapters and frontend interfaces, removing reliance on numerical GTFS route types.

## [0.59.4] - 2026-08-09

### Fixed

- Fixed bug in Brno vehicle map selection caused by overlapping duplicate Kordis RT entities sharing the same coordinates.

## [0.59.3] - 2026-08-08

### Fixed

- **Brno RT Map Feed**: Prioritized active GTFS routes over historical aliases in the RT feed mapping to fix a bug where valid reused trip IDs were incorrectly dropped or hallucinated due to stale alias history.

## [0.59.2] - 2026-08-07

### Fixed

- **Stats API Error**: Resolved an issue where fetching statistics triggered a 'missing parameters' API error instead of returning full data.

## [0.59.1] - 2026-08-07

### Fixed

- **Brno GTFS-RT Trip Alignment**: Introduced `trip_aliases.json` support to resolve legacy `trip_id`s from the live feed to updated static schedule trip IDs following timetable updates.

## [0.58.0] - 2026-07-31

### Added

- **Real-Time Vehicle Registry**: Integrated a full-panel Live Vehicle Registry and Monitor view into the Statistics panel with a 2-option header toggle.

## [0.57.8] - 2026-07-29

### Changed

- **UI & Design System**: Modernized Admin UI layout, unified copy buttons in MCP modal, and polished card components across alerts and stats panels.

## [0.57.7] - 2026-07-27

### Added

- **Empty State UI**: Added standard Shadcn UI `Empty` component state with optimistic highlights for when there are no active service alerts.

## [0.57.6] - 2026-07-27

### Fixed

- **Service Alert Categories**: Unified bus and trolleybus categories, added funicular/ferry mode matching, and added Extended GTFS route types.

## [0.57.5] - 2026-07-27

### Fixed

- **Line Badges**: Restored rounded corner aesthetics, subtle border strokes, and padding for line badges across all transit modes.

## [0.57.4] - 2026-07-27

### Changed

- **Search Panel Redesign**: Unified top search bar and dropdown into a single continuous glass command panel with rounded item rows and category counters.

## [0.57.3] - 2026-07-26

### Added

- **Light Mode Support**: Re-enabled light mode with CARTO Voyager base map tiles and theme switcher UI.

## [0.57.2] - 2026-07-26

### Changed

- **Remote MCP Architecture**: Modularized remote MCP server into dedicated domain handlers (`functions/_mcp/`).

## [0.57.1] - 2026-07-26

### Fixed

- **Glass UI Rendering**: Resolved Firefox backdrop-filter canvas blur bug by increasing base glass opacity.

## [0.57.0] - 2026-07-26

### Added

- **Native Remote MCP Server**: Implemented edge SSE and JSON-RPC 2.0 MCP server at `/mcp` with 5 transit tools (`search_stops`, `get_next_departures`, `get_realtime_vehicles`, `get_service_alerts`, `get_vehicle_detail`).
- **Remote MCP Promotion**: Added glassmorphic banner and interactive setup modal (`McpModal`) with snippets for Claude Code, Claude Desktop, and Cursor.

## [0.56.7] - 2026-07-26

### Fixed

- **Vehicle Filtering**: Filtered out invalid vehicles from KORDIS GTFS-RT feeds.

## [0.56.6] - 2026-07-26

### Fixed

- **GTFS-RT Vehicle Stop Matching**: Implemented multi-tier stop node matching for trains and parent stops.
- **Alert Text Sanitization**: Added HTML tag stripping and line-break formatting for GTFS service alerts.

## [0.56.5] - 2026-07-19

### Added

- **Theme Provider**: Integrated `next-themes` for system preference detection, light/dark mode switching, and MapLibre tile switching.

## [0.56.2] - 2026-07-18

### Changed

- **Stats UI & Analytics Engine**: Decomposed statistics panel into single-responsibility cards powered by a shared mathematical aggregation engine.

## [0.56.1] - 2026-07-16

### Fixed

- **Edge Caching**: Configured `caches.default` Web Cache API for upstream Golemio API requests to prevent Cloudflare Worker rate limits.

## [0.55.0] - 2026-07-16

### Changed

- **Upstream Error Handling**: Standardized error responses across city adapters, returning `upstream_offline` for live streams and HTTP 502 for on-demand actions.

## [0.54.0] - 2026-07-15

### Added

- **Ústecký kraj (DÚK) Region**: Added initial backend services and adapters for Ústecký kraj live vehicles, stops, and departures.

## [0.53.9] - 2026-07-14

### Changed

- **Brno GTFS-RT Migration**: Migrated Brno (IDS JMK) vehicle tracking exclusively to GTFS-RT feeds, removing legacy ArcGIS endpoints.

## [0.53.7] - 2026-07-13

### Added

- **City Configuration Filters**: Added dynamic city configuration filters allowing cities to enable or disable relevant vehicle and stop filter categories.

## [0.53.6] - 2026-07-12

### Fixed

- **Performance**: Fixed O(N²) nested loops in alert mapping and duplicate fetches in KORDIS GTFS-RT feeds.
- **Map Rendering**: Resolved vehicle duplication on Brno map by deduplicating KORDIS GTFS-RT entities.

## [0.53.0] - 2026-07-07

### Added

- **Glassy Dropdowns & Metro Badges**: Applied glassy theme to header dropdown menus and added high-contrast virtual-board style metro track indicators.

## [0.52.16] - 2026-07-07

### Added

- **Region Switcher Animation**: Added pulse and spin animation to the Earth icon when active region changes.

## [0.52.0] - 2026-07-05

### Added

- **System Status Modal**: Added interactive network status modal displaying data freshness, provider information, and sync state.

## [0.51.0] - 2026-07-04

### Added

- **Smooth Vehicle Animations**: Implemented coordinate and bearing interpolation loops via `requestAnimationFrame` for high-60fps vehicle movement on the map.

## [0.50.7] - 2026-07-01

### Fixed

- **Departures API Chunking**: Optimized static stop departures payload splitting to eliminate Cloudflare Worker CPU timeouts.

## [0.50.0] - 2026-07-01

### Added

- **Brno Vehicle Metadata**: Added DPMB model and air-conditioning status resolution based on registration number ranges.

## [0.49.7] - 2026-07-01

### Fixed

- **KORDIS Query Optimization**: Achieved a 45x speedup on KORDIS vehicle queries by requesting required database fields and reducing payload size.

## [0.49.4] - 2026-06-23

### Added

- **Route Shape Visualization**: Added intermediate stop points and start/end terminal markers overlaid on vehicle route lines.

## [0.49.0] - 2026-06-22

### Changed

- **Admin Dashboard**: Moved data explorer tools to `/admin/explorer` and created an `/admin` dashboard.

## [0.48.6] - 2026-06-22

### Added

- **WebMCP Integration**: Integrated WebMCP browser API (`navigator.modelContext`) exposing app tools to AI web agents.

## [0.48.5] - 2026-06-22

### Added

- **AI Discovery (`llms.txt`)**: Added RFC 8288 `Link` header pointing to `llms.txt` for automated agent discovery.

## [0.48.2] - 2026-06-14

### Fixed

- **Cache Stampede Protection**: Implemented isolate-level Promise caching to prevent CPU limits during concurrent cache-miss requests.

## [0.47.1] - 2026-06-07

### Changed

- **Mobile Detail Drawer**: Replaced Vaul drawer with `@base-ui/react` Sheet for mobile `DetailPanel` views.

## [0.47.0] - 2026-06-06

### Added

- **Shadcn UI Unification**: Fully migrated empty states, card containers, search dropdowns, labels, and buttons to official Shadcn UI primitives.

## [0.46.0] - 2026-06-05

### Added

- **Path-Based Routing**: Replaced query-parameter selection with clean URL paths (`/stop/:id`, `/trip/:id`) and `wouter` browser history.

## [0.45.0] - 2026-06-03

### Changed

- **Separation of Mappers & Services**: Extracted data transformation logic into dedicated static `*Mapper` classes (`AlertsMapper`, `DeparturesMapper`, etc.).

## [0.44.0] - 2026-05-29

### Added

- **Multi-City Architecture**: Introduced `CityAdapter` OOP pattern and unified routing under `/api/[city]/*`.

## [0.43.0] - 2026-05-27

### Changed

- **Zustand Zero-Context Migration**: Replaced React Context providers with granular Zustand stores (`selectionStore`, `viewportStore`, `preferencesStore`, `geolocationStore`, `mapMetadataStore`, `pwaStore`).

## [0.41.4] - 2026-05-19

### Changed

- **Bulk Favorite Departures**: Implemented single-request bulk fetching for favorite stops to eliminate N+1 queries.

## [0.41.0] - 2026-05-17

### Added

- **Automated E2E Testing**: Added Playwright end-to-end testing workflow in GitHub Actions.

## [0.38.0] - 2026-05-12

### Added

- **Substitute Line Branding**: Implemented orange branding (#F29400) for substitute X-lines across badges and maps.

## [0.37.0] - 2026-05-11

### Added

- **Stacked Departure Cards**: Grouped multiple destination variants under single line badges on the departure board.

## [0.36.8] - 2026-05-10

### Added

- **Station-Style Departure Board**: Redesigned departure board into a high-density tabular station layout.

## [0.36.0] - 2026-05-05

### Changed

- **Pipeline Optimization**: Consolidated backend transit handlers and pipeline data structures for improved performance.

## [0.35.0] - 2026-05-03

### Added

- **OpenAPI Type Alignment**: Implemented strict type safety aligned with Golemio OpenAPI specifications.
