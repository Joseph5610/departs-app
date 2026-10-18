/**
 * MapLibre GL JS v6 worker bootstrap.
 *
 * v6 is ESM-only and resolves its worker from `import.meta.url` at runtime,
 * expecting `maplibre-gl-worker.mjs` to sit next to the main bundle. After a
 * Vite build the entry is a hashed chunk in /assets, so that lookup 404s and
 * the map never renders. Bundled with `?worker&url` so it is emitted as a
 * `.js` chunk the service worker precaches.
 *
 * Imported for side effects before any map is constructed.
 */
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(maplibreWorkerUrl);
