# Changelog

All notable changes to the **Departs.app** project will be documented in this file.

## [0.10.0] - 2026-03-02

### Added
- **Search History**: The app now remembers your 5 most recent unique searches (stops and line filters).
- **Recent Searches UI**: A new "Recent" section appears in the search dropdown when the search bar is empty, allowing for one-tap access to your frequent locations.
- **Clear History**: Added a button in the Settings modal to easily wipe your search history.

## [0.9.0] - 2026-03-01

### Added
- **Show Stops Toggle**: You can now show or hide public transport stops on the map in the Settings modal. This allows for a cleaner view if you primarily use the app to track live vehicles.

### Changed
- **Extended Visibility**: Lowered the minimum zoom level for live vehicles from 12 to 10, allowing you to see vehicles from a higher altitude.

## [0.8.0] - 2026-02-25

### Added
- **Vehicle Type Filtering**: You can now filter live vehicles on the map by type (Metro, Tram, Bus, Train, etc.) in the Settings modal.
- **Multi-Line Search**: Added support for comma-separated searches (e.g., "58, 136, C") to filter multiple lines simultaneously.
- **Extended Visibility**: Lowered the minimum zoom level for live vehicles from 11 to 9, allowing you to see the transit network from a much higher altitude.

### Changed
- **Settings UI Overhaul**: Redesigned the vehicle type selection with a modern, icon-based grid for better accessibility and visual appeal.
- **Search UI Fixes**: Improved the responsiveness and reliability of the search clear ("X") button on touch devices.

### Fixed
- **Vehicle Type Filtering**: Resolved a bug where filtering by vehicle type resulted in an empty map due to incorrect API parameter mapping.

## [0.7.1] - 2026-02-24

### Changed
- **Stop Proximity Info**: The distance and walking time panel is now hidden for stops further than 750 meters, matching the logic of the "Can I catch it?" indicator to reduce UI noise for distant locations.

## [0.7.0] - 2026-02-24

### Added
- **"Can I catch it?" Indicator**: Real-time 🟢/🟡/🔴 indicators in the departure board based on your walking distance to the stop and current vehicle delay. Indicators are limited to stops within 750m and the logic is tuned to be highly conservative (0.8 m/s walking speed and 2-minute safety buffer).
- **Stop Proximity Info**: Displays current distance (meters) and walking ETA (minutes) in a dedicated pill at the top of the stop departure board.
- **Favorite Stops**: Added a "Star" button to stops. Favorites are persisted to local storage, highlighted on the map with a gold glow, and appear in search results when the input is empty.
- **Delay Trend Tracking**: Introduced visual "Delay Delta" indicators (↑/↓) in departure boards, showing how delay changed since the last update.
- **Improved Search**: The search interface now features a "Favorites" section for quick access to pinned stops.

### Fixed
- **Vehicle Tracking Pulse**: Restored the missing pulse/glow effect for the selected vehicle, ensuring it remains visible even when the camera is not actively following the vehicle.

### Changed
- **UI/UX Optimization**: Redesigned the catch status as compact, high-contrast pills. Removed redundant walking time labels from individual departure rows to keep the interface clean.
- **Enriched State Management**: Enhanced the stop selection logic to store coordinates directly in the active state, enabling immediate distance calculations and better performance.
- **Map Interaction**: Updated vehicle layer interaction IDs to match the latest engine specifications, ensuring reliable click detection for all vehicle types.
- **Enhanced Stop Clusters**: Refined map clusters with a blurred dot style for better legibility at lower zoom levels.
- **Visual Improvements**: Pinned stops now have a subtle gold glow effect on the map for easier identification.

### Removed
- **Experimental Delay Heatmap**: Completely removed the experimental delay heatmap and map delay labels per user feedback to ensure a cleaner and more focused map interface.

## [0.6.2] - 2026-02-24

### Fixed
- **Geolocation Reliability**: Hardened the geolocation watcher to persist through transient errors (like signal loss or timeouts). The watcher now only stops on explicit permission denial, ensuring automatic recovery when GPS signal returns.
- **Location Updates**: Reduced the maximum location age from 60s to 10s to ensure the map shows a more accurate and frequent position while moving.
- **Manual "Locate" Fix**: Enhanced the manual location button to force a fresh position request if the current known location is stale (older than 30s), resolving issues where clicking the button had no effect.

### Added
- **Visual Feedback**: Added a "Searching for your location..." toast and a spinning animation to the location button while a fresh position is being acquired, providing clear feedback during signal acquisition.

## [0.6.1] - 2026-02-23

### Fixed
- **Mobile Scrolling**: Fixed an issue where the connection list in the `DetailPanel` could not be scrolled to the very end when in the "peek" (half-open) state. Added a dynamic animated `padding-bottom` that compensates for the hidden portion of the sheet.
- **Interaction Logic**: Disabled content scrolling when the `DetailPanel` is in the "collapsed" state to prevent accidental interactions and ensure focus on the main map.

## [0.6.0] - 2026-02-23

### Added
- **Metro Night Message**: Implemented a custom "sleeping" state for metro stations during night hours (0:00 - 5:00). When there are no departures, users see a friendly message suggesting night trams and buses instead of a generic empty board.

## [0.5.13] - 2026-02-22

### Added
- **Visual Feedback**: Implemented tactile `active:` states (scale and background color transitions) for all map controls, search results, and alert components to provide immediate response to user taps.

### Changed
- **Interaction Model**: Restricted `DetailPanel` dragging exclusively to the header/handle area. This prevents accidental sheet movement when scrolling through the content list.
- **Snapping Logic**: Enhanced the bottom sheet snapping algorithm with velocity projection and tuned thresholds, providing a more "magnetic" and stable feel during transitions.
- **Component Renaming**: Renamed `BottomSheet` to `DetailPanel` to better reflect its responsive role as a sidebar on desktop and a bottom sheet on mobile.
- **Performance Optimization**: Improved mobile (iOS) interaction smoothness by memoizing expensive components and switching to pure transform-based animations.

### Fixed
- **UI Clipping**: Fixed an issue where the back button's circular background was partially cut off by removing `overflow-hidden` from the header containers and refining title truncation.

## [0.5.10] - 2026-02-22

### Changed
- **Performance Optimized BottomSheet**: Refactored the mobile bottom sheet to use hardware-accelerated `y` transforms instead of `height` animations, resolving UI lags during opening and interactions.
- **Native-like Gestures**: Implemented a responsive dragging system using Framer Motion's `useDragControls` that allows the sheet to immediately follow the user's finger.
- **Three-State Snapping**: Added a third "collapsed" state at the bottom of the screen, allowing users to keep the departure board title visible while maximizing map area.
- **Interactive Scroll Integration**: Enhanced the touch logic to seamlessly switch between dragging the sheet and scrolling the connection list, mimicking native iOS/Android behavior.

### Fixed
- **Animation Smoothness**: Eliminated layout shifts by maintaining a constant 92% sheet height on mobile, regardless of its visual position.

## [0.5.9] - 2026-02-22

### Added
- **Platform Indicator UI**: Replaced parentheses-based platform codes in the departure board header with a dedicated, styled neutral circle badge.
- **Isolated Platform Data**: Updated the application state and selection logic to store `platformCode` as a separate field, improving data structure and enabling independent UI rendering.
- **Enhanced URL Synchronization**: Added support for a `stopPlatform` URL parameter for more robust deep-linking.
- **Backward Compatibility**: Implemented automatic parsing of legacy URL stop names (e.g., "Stop Name (A)") to extract platform codes and maintain valid state from old links.

## [0.5.8] - 2026-02-21

### Changed
- **Codebase Simplification**: Significantly reduced DOM depth and CSS complexity by removing unused `App.css`, redundant wrapper `div` elements, and unnecessary classes across all major components.
- **Global Layout Refactor**: Consolidated full-screen layout logic into `index.css`. Standardized iOS safe-area inset management using centralized CSS utility classes (`.safe-top`, `.safe-bottom`, etc.), replacing repetitive inline JavaScript calculations.
- **Component Cleanup**: Streamlined `App`, `Map`, `BottomSheet`, `Modal`, `Search`, and `MapControls` components for better maintainability and performance.

## [0.5.7] - 2026-02-21

### Fixed
- **iOS PWA Fullscreen (Improved)**: Flattened the DOM hierarchy and simplified the layout strategy to resolve resolution-dependent black bar issues on iOS. Used `position: fixed` on the body and anchored main containers with `inset-0` to ensure consistent rendering across different window sizes and orientations.

## [0.5.6] - 2026-02-21

### Fixed
- **iOS PWA Fullscreen**: Re-implemented the fullscreen layout to resolve the persistent black bar issue on iOS. Removed `100dvh` constraints in favor of absolute anchoring (`top/bottom: 0`) and `-webkit-fill-available` on the body to ensure the app occupies the entire screen area, including the safe area at the bottom.

## [0.5.4] - 2026-02-19

### Fixed
- **Map Interaction Logic**: Resolved a race condition where vehicle tracking would persist after selecting a stop on the map. Implemented atomic selection actions (`SELECT_STOP`, `SELECT_VEHICLE`) in the map reducer to ensure consistent state transitions.
- **Tracking Synchronization**: Hardened the vehicle sync hook to prevent "selection revival" by using functional state updates, ensuring that background data refreshes never restore a selection that the user has intentionally cleared.

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
