# Changelog

All notable changes to `departs.app` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.59.0] - 2026-08-07

### Fixed

- **Brno GTFS-RT Coverage**: Updated static GTFS pipeline to map all schedule trips in `trip_routes.json`, increasing real-time vehicle matching coverage from ~54% to 98.4%.

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
