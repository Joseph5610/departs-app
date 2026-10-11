import { FRONTEND_CITIES_CONFIG, FALLBACK_CITY_CONFIG } from '@/config/cities';
import { useGeolocationStore } from '@/state/geolocationStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { LAUNCH_VIEW, MAP_CAMERA } from '@/config/constants';
import { useViewportStore } from '@/state/viewportStore';
import { launchCamera, type Camera } from '@/domain/cities';
import { matchRoutePath } from '@/lib/routes';
import { replaceUrl } from '@/lib/history';

const CAMERA_PARAMS = ['lat', 'lng', 'z'] as const;

/** A camera in the opening URL, from an old link or bookmark; read once, before the URL is cleaned. */
const readUrlCamera = (): Camera | null => {
    if (typeof window === 'undefined') return null;
    const p = new URLSearchParams(window.location.search);
    const [lat, lng, zoom] = CAMERA_PARAMS.map(key => Number(p.get(key) ?? NaN));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, zoom: Number.isFinite(zoom) ? zoom : MAP_CAMERA.USER_LOCATION_ZOOM };
};

const launchUrlCamera = readUrlCamera();

/** Whether the app was opened with a camera in its URL, the view the link's sender meant. */
export const hasLaunchUrlCamera = () => launchUrlCamera !== null;

/** Drops camera parameters from the URL: the map no longer keeps its view there, and they could reveal a position. */
export const stripUrlCamera = () => {
    const url = new URL(window.location.href);
    if (!CAMERA_PARAMS.some(key => url.searchParams.has(key))) return;
    for (const key of CAMERA_PARAMS) url.searchParams.delete(key);
    replaceUrl(url.toString());
};

/** The camera the map opens at: see `launchCamera`, for the city in the URL or else the selected one. */
export const getInitialViewState = () => {
    const urlCity = typeof window !== 'undefined' ? matchRoutePath(window.location.pathname).city : null;
    const city = (urlCity && FRONTEND_CITIES_CONFIG[urlCity]) || FRONTEND_CITIES_CONFIG[usePreferencesStore.getState().selectedCity] || FALLBACK_CITY_CONFIG;
    const { lastLocation, lastLocationAt } = useGeolocationStore.getState();
    const { savedCamera, savedCameraAt } = useViewportStore.getState();

    const { camera } = launchCamera({
        urlCamera: launchUrlCamera,
        lastLocation: lastLocation ? { value: lastLocation, at: lastLocationAt } : null,
        savedCamera: savedCamera ? { value: savedCamera, at: savedCameraAt } : null,
        city,
        now: Date.now(),
        maxAgeMs: LAUNCH_VIEW.SAVED_MAX_AGE_MS,
        zoom: { location: MAP_CAMERA.USER_LOCATION_ZOOM, city: MAP_CAMERA.CITY_OVERVIEW_ZOOM },
    });
    return { latitude: camera.lat, longitude: camera.lng, zoom: camera.zoom };
};

const MAX_MERCATOR_LAT = 85.0511;

const lonToTileX = (lon: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));

const latToTileY = (lat: number, n: number) => {
    const rad = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat)) * Math.PI / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
    return Math.min(n - 1, Math.max(0, y));
};

const tileXToLon = (x: number, n: number) => (x / n) * 360 - 180;

const tileYToLat = (y: number, n: number) => Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180 / Math.PI;

/**
 * Expands `south,west,north,east` bounds outward to the edges of the XYZ map tiles at `tileZoom`.
 * Nearby viewports then produce the same bounds, so they share cached API responses and small pans
 * inside a tile do not change the request.
 */
export const snapBoundsToTiles = (
    south: number,
    west: number,
    north: number,
    east: number,
    tileZoom: number
): [number, number, number, number] => {
    const n = 2 ** tileZoom;
    // Tile y grows southward, so the north edge maps to the smaller index.
    const minX = lonToTileX(west, n);
    const maxX = lonToTileX(east, n) + 1;
    const minY = latToTileY(north, n);
    const maxY = latToTileY(south, n) + 1;
    return [tileYToLat(maxY, n), tileXToLon(minX, n), tileYToLat(minY, n), tileXToLon(maxX, n)];
};

/** Camera move to a city's overview, for opening or switching a city. */
export const cityOverviewCamera = (center: [number, number]) => ({
    center,
    zoom: MAP_CAMERA.CITY_OVERVIEW_ZOOM,
    duration: MAP_CAMERA.ANIMATION_MS,
});
