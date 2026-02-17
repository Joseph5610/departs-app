
/**
 * UI and Layout constants
 */
export const SIDEBAR_WIDTH = 420;
export const MOBILE_BREAKPOINT = 768;

/**
 * Map defaults and configuration
 */
export const MAP_DEFAULT_COORDS = {
    lat: 50.0755,
    lng: 14.4378
};

export const MAP_DEFAULT_ZOOM = 13;
export const MAP_USER_LOCATION_ZOOM = 15;
export const MAP_MIN_ZOOM_FOR_VEHICLES = 11;

export const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/**
 * Local Storage keys
 */
export const LS_KEYS = {
    LAST_USER_LOCATION: 'lastUserLocation',
    SHOW_VEHICLES: 'showVehicles',
    DEPARTURE_SORT: 'departureSort',
    WELCOME_SEEN: 'departs_welcome_seen'
} as const;

import type { FeatureCollection } from 'geojson';

/**
 * Common GeoJSON structures
 */
export const EMPTY_GEOJSON: FeatureCollection = {
    type: 'FeatureCollection',
    features: []
};

/**
 * Interaction and Timers
 */
export const BOUNDS_DEBOUNCE_MS = 800;
export const MAP_MOVE_DURATION_MS = 1000;
export const MAP_FLY_DURATION_MS = 2000;
