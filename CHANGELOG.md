# Changelog

All notable changes to this project will be documented in this file.

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
