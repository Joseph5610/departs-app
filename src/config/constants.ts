
/**
 * UI and Layout constants
 */
export const SIDEBAR_WIDTH = 450;
export const MOBILE_BREAKPOINT = 768;
export const MOBILE_BOTTOM_SHEET_RATIO = 2.2;

/**
 * Map configuration defaults
 */
export const MAP_DEFAULT_COORDS = {
    lat: 50.0755,
    lng: 14.4378,
    zoom: 13,
    userZoom: 15
};

export const MAP_BOUNDS_DEBOUNCE = 800;
export const MAP_MIN_ZOOM_FOR_DATA = 9;

/**
 * Animation and interaction constants
 */
export const MAP_ANIMATION_DURATION = 1500;
export const MAP_FLY_DURATION = 2000;
export const MAP_STOP_SELECT_ZOOM = 16;
export const MAP_VEHICLE_SELECT_ZOOM = 15;

/**
 * Local Storage Keys
 */
export const STORAGE_KEYS = {
    SHOW_VEHICLES: 'showVehicles',
    DEPARTURE_SORT: 'departureSort',
    LAST_LOCATION: 'lastUserLocation',
    WELCOME_SEEN: 'departs_welcome_seen',
    FAVORITES: 'favoriteStops'
};

/**
 * API and Transit constants
 */
export const VEHICLE_REFETCH_INTERVAL = 10000;
export const VEHICLE_STALE_TIME = 5000;
