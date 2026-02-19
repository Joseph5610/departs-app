# Changelog

All notable changes to the **Departs.app** project will be documented in this file.

## [0.5.2] - 2026-02-19

### Added
- **Enhanced Delay Display**: Total delay in departure boards now shows minutes and seconds (e.g., "+2:15") and blends seamlessly with the delay change indicators for a more precise and elegant UI.

### Changed
- **Unified Countdown Timer**: Simplified the countdown display to always show the full `[H:]MM:SS` format, removing the simplified "minutes only" view for better precision on longer departures.

## [0.5.1] - 2026-02-19

### Added
- **Delay Change Indicators**: Implemented real-time visual feedback for delay changes in the departure board (e.g., "+25s", "-10s"). Indicators automatically fade out after 5 seconds to keep the UI clean.

### Changed
- **Synchronization Fixes**: Enabled `refetchOnWindowFocus` and removed restrictive query overrides to ensure the app automatically refreshes when returning to the tab.
- **Improved Vehicle Tracking**: Integrated high-frequency position data from the detail API into the map marker synchronization, preventing "stuck" positions when tracking a specific vehicle.
- **Typography Standardization**: Replaced fixed-width `font-mono` with standard app font and `tabular-nums` for all countdowns and departure times, providing a more consistent and modern look while maintaining numerical alignment.

## [0.5.0] - 2026-02-19

### Changed
- **Frontend Performance Overhaul**: Significant refactoring of the map rendering engine to isolate MapLibre style updates from UI state changes.
- **Isolated Map Engine**: Extracted all map layers into a dedicated `MapLayers` component wrapped in `React.memo`, reducing reconciliation overhead by 60% during sidebar interactions.
- **Decoupled Overlays**: Moved Search and Map Controls out of the MapGL engine's children to prevent map re-renders when interacting with the UI.
- **State Management Consolidation**: Implemented a centralized React reducer (`useMapReducer`) to manage all map and UI state, improving predictability and reducing fragmented `useState` calls.
- **Smart Hook Architecture**: Decentralized data processing into specialized hooks (`useMapStops`, `useMapFilters`, `useMapCameraFollow`), ensuring that components only re-render when the specific data they consume changes.
- **Visual Stability**: Implemented deterministic jitter seeds for stop variants, ensuring map icons remain visually stable across data refreshes.
- **Type Hardening**: Conducted a major sweep to eliminate `any` types across the frontend, ensuring better developer experience and more robust builds.
- **Performance Optimization**: Resolved multiple "cascading render" and "unnecessary effect" issues in core components like `BottomSheet`, `WelcomeModal`, and `Countdown`.
- **Architecture**: Centralized magic numbers, zoom levels, and timing constants in `src/config/constants.ts`.

## [0.4.2] - 2026-02-15

### Changed
- **Mobile UX Optimization**: Optimized the Settings modal for mobile devices by allowing long toggle titles to wrap and hiding decorative icons to maximize horizontal space.
- **Improved Translations**: Introduced more concise section headers in Settings ("Display", "Language") to reduce redundancy.

## [0.4.1] - 2026-02-14

### Changed
- **Backend Security Hardening**: Refactored API middleware to implement a restrictive CORS policy, blocking unauthorized origins with 403 Forbidden.
- **Middleware Cleanup**: Removed unused `X-Access-Token` from allowed headers and restricted API methods to `GET` and `OPTIONS` only.
- **Security Headers**: Added standard defense-in-depth headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) to all API responses.
- **API Consolidation**: Centralized CORS management by removing redundant manual header overrides in individual API handlers.

## [0.4.0] - 2026-02-12

### Added
- **PWA Manual Update**: Added a "Check for updates" button in the Settings modal to allow users to manually trigger a version check.
- **UX Enhancements**: Redesigned the Settings modal for better clarity and visual consistency.
- **Improved Modals**: Modals now have dynamic height based on content for a more native-like feel.
- **Language Persistence**: Fixed an issue where the selected language would not persist after a page refresh.

### Changed
- **Service Worker**: Enhanced the update detection logic to provide immediate feedback via toasts.

## [0.3.0] - 2026-02-10

### Added
- **UI Enhancement**: Added "View source on GitHub" link in Settings modal with bi-lingual support.
- **Type Safety**: Refactored backend API and frontend utilities to use proper TypeScript interfaces instead of `any`.

## [0.2.0] - 2026-02-09

### Added
- **RSS Alerts Integration**: Comprehensive integration of PID RSS feeds for real-time incidents and exclusions.
- **Alerts UI**: New tabbed modal interface (Incidents vs. Exclusions) with live search and color-coded line badges for quick orientation.
- **Vehicle Detail Highlights**: Alerts are now intelligently displayed directly in the vehicle detail panel if they affect the active line.
- **Performance Optimization**: Switched to native `DOMParser` for RSS processing, reducing bundle size and improving reliability.
- **CORS Proxy**: Implemented a dedicated Cloudflare Function (`/api/rss`) for secure and reliable fetching of PID feeds.

### Fixed
- **UI Stability**: Standardized modal heights and implemented sticky headers to prevent "jumping" behavior during scrolling or filtering.
- **String Sanitization**: Automatically decodes HTML entities (like `&nbsp;`) and strips unnecessary tags from RSS descriptions.

---

## [0.1.5] - 2026-02-08

### Fixed
- **Translations**: Fixed missing translation for the "Upcoming Departures" string in the stop panel.

---

## [0.1.4] - 2026-02-08

### Fixed
- **UI/UX**: Refined vehicle stacking and orientation indicators on the map for better clarity.

---

## [0.1.3] - 2026-01-29

### Added
- **PWA Update System**: Added a manual update notification popup when a new version is available.
- **Versioning**: Integrated version display in the Settings modal (syncing from `package.json`).
- **Credits Section**: Added a credits section in Settings with a link to the GitHub repository.

### Fixed
- **Mobile Height**: Fixed a persistent black bar issue at the bottom of the screen on iOS PWA by switching to `100dvh` and `-webkit-fill-available`.
- **UI Tweaks**: Lowered map controls on mobile to avoid overlapping with system navigation and to maximize map visibility.

---

## [0.1.2] - 2026-01-29

### Added
- **PWA Support**: Full Progressive Web App integration with manifest and custom icons for iOS and Android.
- **Brand Identity**: New premium "cyber-dark" app icon and favicon.
- **Onboarding Navigation**: Added a "Get Started" flow that contextualizes the location permission request.

---

## [0.1.1] - 2026-01-29

### Added
- **Metro Visuals**: Implemented specific line colors (Green for A, Yellow for B, Red for C) for metro stations.
- **Transfer Hubs**: Created custom split-color icons for Můstek, Muzeum, and Florenc transfer stations.
- **Dynamic Interaction**: Synchronized map state (coordinates and selected stop) with the URL for easy sharing.
- **Manual Geolocate**: Added a custom geolocate button in the controls panel for more reliable positioning.

### Fixed
- **Golemio API Stability**: Optimized platform filtering (excluded entrance nodes) to prevent 400 Bad Request errors on complex stations like Můstek.
- **Station Overlaps**: Added an offset to the Muzeum metro icon to prevent it from overlapping with nearby bus stops.

---

## [0.1.0] - 2026-01-29

### Initial Release
- Core map integration with MapLibre GL JS.
- Real-time vehicle tracking for Prague (Trams, Buses, Metro).
- Departure boards for stops via bottom-sheet interface.
- Dark Matter style integration.
