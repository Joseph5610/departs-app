
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
export const MAP_EASE_DURATION = 1000;
export const MAP_STOP_SELECT_ZOOM = 16;
export const MAP_VEHICLE_SELECT_ZOOM = 15;
export const MAP_MIN_STOP_ZOOM = 14;

/**
 * Pulse animation constants for the selected vehicle indicator.
 * Controls the pulsing ring effect around the selected vehicle on the map.
 */
export const PULSE_SPEED_DIVISOR = 350;
export const PULSE_BASE_RADIUS = 20;
export const PULSE_RADIUS_AMPLITUDE = 15;
export const PULSE_BASE_OPACITY = 0.6;
export const PULSE_OPACITY_DIVISOR = 50;

/**
 * Local Storage Keys
 */
export const STORAGE_KEYS = {
    SHOW_VEHICLES: 'showVehicles',
    SHOW_STOPS: 'showStops',
    DEPARTURE_SORT: 'departureSort',
    LAST_LOCATION: 'lastUserLocation',
    WELCOME_SEEN: 'departs_welcome_seen',
    FAVORITES: 'favoriteStops',
    SEARCH_HISTORY: 'searchHistory'
};

/**
 * API and Transit constants
 */

/**
 * Average walking speed in m/s (3.6 km/h)
 * Adjusted for urban environments.
 */
export const WALKING_SPEED = 1.0;

/**
 * Buffer time in seconds to account for platform navigation, ticket validation, etc.
 */
export const CATCH_BUFFER = 120;

/**
 * Transit data refresh intervals
 */
export const TRANSIT_REFRESH_S = 10;
export const TRANSIT_REFRESH_MS = TRANSIT_REFRESH_S * 1000;
