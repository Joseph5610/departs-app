# NextStop - Implementation Plan & Progress

**Goal:** Build a modern, fast, and visual-first PWA for Prague public transport (PID). Focus on real-time vehicle visualization, stop departures, and a premium "glassmorphism" UI.

---

## 🏗️ Architecture & Progress

| Component | Status | Description |
| :--- | :---: | :--- |
| **Frontend** | ✅ | React (Vite) + TypeScript + TailwindCSS. |
| **Map Engine** | ✅ | MapLibre GL JS with Carto Dark Matter style. |
| **Data Proxy** | ✅ | Cloudflare Functions proxying Golemio API (Key hidden). |
| **Edge Caching** | ✅ | Implemented via Cloudflare Workers for vehicle/stop data. |
| **Live Tracking** | ✅ | Trams, buses, and metro positions with bearing arrows. |
| **URL Sync** | ✅ | Map state (lat, lng, zoom) and selected stop synced to URL. |
| **Manual Geolocation** | ✅ | Custom button for user location with fallback logic. |

---

## ✅ Task List

### 1. Project Initial Setup
- [x] Initialize React + Vite project with TypeScript.
- [x] Configure Cloudflare Pages & Functions support.
- [x] Setup TailwindCSS for styling.

### 2. Data Layer (PID API)
- [x] Create Cloudflare Functions to proxy PID API (`/api/vehicles`, `/api/stops`, `/api/departures`).
- [x] Implement smart caching (20s for vehicles, longer for stops).
- [x] API Optimization: Exclude non-platform nodes (entrances/internal) to prevent 400 errors.

### 3. Map Core
- [x] Integrate MapLibre GL JS + `react-map-gl`.
- [x] Render vehicles with rotating bearing arrows.
- [x] Render stops with clustering.
- [x] **Metro Special Visuals**: Distinct colors for Lines A/B/C and custom split-icons for transfer stations (Můstek, Muzeum, Florenc).
- [x] Visual Fixes: `icon-offset` for Muzeum to prevent overlap with bus stops.

### 4. UI Implementation
- [x] "Modern/Glassmorphism" layout (LiveStatus pill, Sidebar buttons).
- [x] Bottom sheet for stop details (Departures countdown).
- [x] Onboarding: Welcome Modal.
- [x] Settings: Toggle vehicles visibility.
- [ ] **Search functionality**: Search for stop names. (⏳ *Missing*)
- [ ] **Nearest Stops**: List stops sorted by distance when search is active. (⏳ *Missing*)

### 5. PWA Features
- [ ] Manifest config (Icons, theme color). (⏳ *Missing/Unverified*)
- [ ] Service Worker setup for offline shell. (⏳ *Missing/Unverified*)

---

## 🛠️ Next Technical Steps
1. **Search Integration**: Add a floating search bar to find stops by name.
2. **PWA Manifest**: Ensure the app is truly installable with proper icons and splash screens.
3. **Sorting by Distance**: Use the user's location to sort the "nearby" stops list.
4. **Performance**: Audit MapLibre layers for potential optimization on mobile.

---
*Last updated: 2026-01-29*
