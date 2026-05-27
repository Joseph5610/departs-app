# Zustand Migration Phase 3: Logic & Refinement

## Context
Phase 2 (Zero-Context Architecture) is complete. All global state is in Zustand, and all React Context providers have been eliminated. The application is now "provider-free" for internal logic, using headless hooks for PWA and Geolocation.

## Completed in Phase 2
- **Zero-Context**: Deleted `src/state/contexts.ts` and `src/state/pwa-context.ts`.
- **Global MapRef**: `mapRef` is managed in `MapMetadataStore`.
- **Headless Hooks**: `useGeolocation.ts` and `usePWALifecycle.ts` manage lifecycles silently.
- **MapController**: Refactored to a pure event orchestrator using `useMapEvents`.
- **Performance**: Components use granular selectors to minimize re-renders.

## TODO: Phase 3
1. **Move Interaction Logic to Store Actions**:
   - Leverage `mapRef` in the store to move complex flows (e.g., "search result click -> flyTo -> open panel") from `useEffect` into imperative store actions.
2. **Persistence Refinement**:
   - Review and refine `persist` middleware usage in `PreferencesStore`.
   - Ensure ephemeral state (like temporary selections) is not persisted, while user preferences (map style, favorite transit types) are.
3. **URL Sync Consolidation**:
   - Streamline `useMapUrlSync.ts` to be the single source of truth for URL state, strictly using store primitives.
4. **Performance Optimization**:
   - Audit re-render cycles in `MapLayers.tsx` and `DetailPanel.tsx` using React DevTools.
   - Further optimize `useMapFilters` and `useVehicles` if necessary.

## Invariants
- **Minimal State**: Only IDs and primitives in stores. Derivations happen in selectors or hooks.
- **CI Stability**: `playwright.config.ts` must never be deleted.
