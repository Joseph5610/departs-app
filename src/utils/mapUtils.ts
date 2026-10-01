import { FRONTEND_CITIES_CONFIG, FALLBACK_CITY_CONFIG } from '../config/cities';
import { useGeolocationStore } from '../state/geolocationStore';
import { usePreferencesStore } from '../state/preferencesStore';
import { MAP_CAMERA, SHARED_GROUND } from '../config/constants';
import type { NetworkCoverage } from '../types/cities';

/**
 * Calculates the initial map view state based on URL parameters or stored user location.
 * Falls back to default city configuration if no other data is available.
 *
 * @returns Object containing initial latitude, longitude, and zoom
 */
export const getInitialViewState = () => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

    // Extract city from pathname (e.g. /brno) to use as default center, else the persisted city
    let defaultCity = FRONTEND_CITIES_CONFIG[usePreferencesStore.getState().selectedCity] ?? FALLBACK_CITY_CONFIG;
    if (typeof window !== 'undefined') {
        const pathParts = window.location.pathname.split('/');
        const possibleCitySlug = pathParts[1];
        
        if (FRONTEND_CITIES_CONFIG[possibleCitySlug]) {
            defaultCity = FRONTEND_CITIES_CONFIG[possibleCitySlug];
        }
    }

    // Default values
    let lat = defaultCity.center[1];
    let lng = defaultCity.center[0];
    let z = MAP_CAMERA.CITY_OVERVIEW_ZOOM;

    // Try to get from persisted geolocation store if no URL params are present
    if (typeof window !== 'undefined' && !p.has('lat') && !p.has('lng')) {
        const savedLocation = useGeolocationStore.getState().lastLocation;
        if (savedLocation && typeof savedLocation.lat === 'number' && typeof savedLocation.lng === 'number') {
            const { lat: sLat, lng: sLng } = savedLocation;
            // Check if saved location belongs to the requested city.
            // If we navigate to /brno but saved location is Prague, ignore it!
            const [minLng, minLat, maxLng, maxLat] = defaultCity.bounds;
            const isInsideCity = (sLng >= minLng && sLng <= maxLng && sLat >= minLat && sLat <= maxLat);
            
            if (isInsideCity) {
                lat = sLat;
                lng = sLng;
                z = MAP_CAMERA.USER_LOCATION_ZOOM;
            }
        }
    }

    return {
        latitude: parseFloat(p.get('lat') || lat.toString()),
        longitude: parseFloat(p.get('lng') || lng.toString()),
        zoom: parseFloat(p.get('z') || z.toString())
    };
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

interface CityExtent {
    slug: string;
    bounds: [number, number, number, number];
}

/** `[west, south, east, north]` */
export type Box = [number, number, number, number];

/** Whether `box` overlaps a city's `bounds`, which frame the city itself rather than its whole network. */
export const overlapsBounds = ({ bounds: [minLng, minLat, maxLng, maxLat] }: CityExtent, [west, south, east, north]: Box): boolean =>
    west <= maxLng && east >= minLng && south <= maxLat && north >= minLat;

/** How many stops a network has in `box`, from its coverage grid. */
export const stopsInBox = ({ cell, cells }: NetworkCoverage, [west, south, east, north]: Box): number => {
    let total = 0;
    for (let x = Math.floor(west / cell); x <= Math.floor(east / cell); x++) {
        for (let y = Math.floor(south / cell); y <= Math.floor(north / cell); y++) {
            total += cells[`${x}|${y}`] ?? 0;
        }
    }
    return total;
};

/**
 * The network to select for a view: `preferredSlug` while it keeps a fair share of the stops in
 * view, else the network with the most. A network whose coverage has not loaded is not picked, and
 * keeps the selection if it holds it. Undefined where no network has stops.
 */
export const pickCity = <T extends CityExtent>(cities: T[], coverages: ReadonlyMap<string, NetworkCoverage>, box: Box | ((coverage: NetworkCoverage) => Box), preferredSlug?: string): T | undefined => {
    let best: T | undefined;
    let bestCount = 0;
    let preferred: T | undefined;
    let preferredCount = 0;
    for (const city of cities) {
        const coverage = coverages.get(city.slug);
        if (!coverage) {
            if (city.slug === preferredSlug) preferred = city;
            continue;
        }
        const count = stopsInBox(coverage, typeof box === 'function' ? box(coverage) : box);
        if (city.slug === preferredSlug) { preferred = city; preferredCount = count; }
        if (count > bestCount) { best = city; bestCount = count; }
    }
    if (!preferred) return best;
    // Unknown coverage keeps the selection until it loads.
    if (!coverages.has(preferred.slug)) return preferred;
    return preferredCount > 0 && preferredCount >= bestCount * SHARED_GROUND.KEEP_SELECTED_SHARE ? preferred : best;
};

/** The network `[lng, lat]` belongs to, if any; `preferredSlug` wherever it runs a fair share of the stops. */
export const findCityAt = <T extends CityExtent>(cities: T[], coverages: ReadonlyMap<string, NetworkCoverage>, [lng, lat]: [number, number], preferredSlug?: string): T | undefined =>
    pickCity(cities, coverages, ({ cell }) => [lng - cell, lat - cell, lng + cell, lat + cell], preferredSlug);

/** Camera move to a city's overview, for opening or switching a city. */
export const cityOverviewCamera = (center: [number, number]) => ({
    center,
    zoom: MAP_CAMERA.CITY_OVERVIEW_ZOOM,
    duration: MAP_CAMERA.ANIMATION_MS,
});
