# Changelog

All notable changes to the **Departs.app** project will be documented in this file.

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
