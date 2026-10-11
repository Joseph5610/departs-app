/** A map camera: its centre and zoom. */
export interface Camera {
    lat: number;
    lng: number;
    zoom: number;
}

/** A position or camera kept on the device, with when it was taken. */
interface Saved<T> {
    value: T;
    at: number;
}

export interface LaunchViewInput {
    /** A camera in the opening URL (`?lat=&lng=&z=`), from an old link or bookmark. */
    urlCamera: Camera | null;
    /** The user's last coarse position, kept from the previous fix. */
    lastLocation: Saved<{ lat: number; lng: number }> | null;
    /** Where the map was when the app was last used. */
    savedCamera: Saved<Camera> | null;
    /** The city the app opens in, from the URL or the device. */
    city: { center: [number, number]; bounds: [number, number, number, number] };
    now: number;
    /** How old a saved position or camera may be and still be reopened. */
    maxAgeMs: number;
    zoom: { location: number; city: number };
}

export type LaunchSource = 'url' | 'location' | 'saved' | 'city';

const isInside = ([west, south, east, north]: [number, number, number, number], lng: number, lat: number) =>
    lng >= west && lng <= east && lat >= south && lat <= north;

/**
 * The camera the map opens at, before any fresh position: a camera in the URL, else the user's recent position,
 * else where they last left the map, else the city overview. Saved ones count only while recent and inside
 * the opening city, so a stale or foreign one never pulls the map away from the city being opened.
 */
export const launchCamera = ({ urlCamera, lastLocation, savedCamera, city, now, maxAgeMs, zoom }: LaunchViewInput): { camera: Camera; source: LaunchSource } => {
    if (urlCamera) return { camera: urlCamera, source: 'url' };
    const usable = <T extends { lat: number; lng: number }>(saved: Saved<T> | null): saved is Saved<T> =>
        !!saved && now - saved.at <= maxAgeMs && isInside(city.bounds, saved.value.lng, saved.value.lat);
    if (usable(lastLocation)) return { camera: { ...lastLocation.value, zoom: zoom.location }, source: 'location' };
    if (usable(savedCamera)) return { camera: savedCamera.value, source: 'saved' };
    return { camera: { lat: city.center[1], lng: city.center[0], zoom: zoom.city }, source: 'city' };
};

export interface LaunchFocusInput {
    /** The supported city the position lies in, if any. */
    cityAtLocation: string | null;
    selectedCity: string;
    /** Accuracy of the fix in metres. */
    accuracyM: number;
    /** The user has moved the map since the app opened or resumed. */
    userMoved: boolean;
    /** A stop, trip or point of sale is open; it belongs to its own city and view. */
    hasOpenEntity: boolean;
    hasActiveRide: boolean;
    /** Zooms by accuracy, finest first: the first whose `maxAccuracyM` the fix meets. */
    zoomSteps: readonly { maxAccuracyM: number; zoom: number }[];
}

/**
 * Where a fresh position at launch or on return to the app moves the map: onto the user, switching to the city
 * they are in. Nothing when they are outside every city, already moved the map, have something open or ride.
 */
export const launchFocus = ({ cityAtLocation, selectedCity, accuracyM, userMoved, hasOpenEntity, hasActiveRide, zoomSteps }: LaunchFocusInput): { city: string; zoom: number; switchesCity: boolean } | null => {
    if (!cityAtLocation || userMoved || hasOpenEntity || hasActiveRide) return null;
    const step = zoomSteps.find(s => accuracyM <= s.maxAccuracyM) ?? zoomSteps[zoomSteps.length - 1];
    return { city: cityAtLocation, zoom: step.zoom, switchesCity: cityAtLocation !== selectedCity };
};
