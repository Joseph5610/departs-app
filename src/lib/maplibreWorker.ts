/**
 * MapLibre GL JS v6 worker bootstrap.
 *
 * v6 is ESM-only and resolves its worker from `import.meta.url` at runtime,
 * expecting `maplibre-gl-worker.mjs` to sit next to the main bundle. After a
 * Vite build the entry is a hashed chunk in /assets, so that lookup 404s and
 * the map never renders. The worker is itself an ES module that imports a
 * shared chunk, so it has to be bundled (`?worker&url`) rather than copied
 * as a plain asset (`?url`).
 *
 * Imported for side effects before any map is constructed.
 */
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(maplibreWorkerUrl);
