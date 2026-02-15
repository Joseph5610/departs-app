/**
 * LocalStorage keys used throughout the application.
 */
export const STORAGE_KEYS = {
    SHOW_VEHICLES: 'showVehicles',
    DEPARTURE_SORT: 'departureSort',
    LAST_USER_LOCATION: 'lastUserLocation',
    WELCOME_SEEN: 'departs_welcome_seen'
} as const;

/**
 * Default map view settings (Prague center).
 */
export const MAP_DEFAULTS = {
    LAT: 50.0755,
    LNG: 14.4378,
    ZOOM: 13,
    USER_LOCATION_ZOOM: 15,
    MIN_ZOOM_BOUNDS: 11,
    MAX_ZOOM_BOUNDS: 13,
    SIDEBAR_WIDTH: 420,
    MOBILE_BREAKPOINT: 768,
    STYLE_URL: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
};

/**
 * Business logic constants.
 */
export const TRANSIT_CONFIG = {
    NIGHT_TRAM_MIN: 90,
    NIGHT_TRAM_MAX: 99,
    NIGHT_BUS_MIN: 900,
    NIGHT_BUS_LENGTH: 3,
    NIGHT_BUS_PREFIX: '9'
} as const;
