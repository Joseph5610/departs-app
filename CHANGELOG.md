# Changelog

All notable changes to this project will be documented in this file.

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
