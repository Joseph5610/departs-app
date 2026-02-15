/**
 * API endpoints for the frontend to communicate with Cloudflare Functions.
 */
export const API_ENDPOINTS = {
    STOPS: '/api/stops',
    DEPARTURES: (stopId: string) => `/api/departures?stopId=${encodeURIComponent(stopId)}`,
    VEHICLES: (bounds: string | null, trackedId: string | null, routeFilter: string[] | null) => {
        const url = new URL('/api/vehicles', window.location.origin);
        if (bounds) url.searchParams.set('bounds', bounds);
        if (trackedId) url.searchParams.set('tripId', trackedId);
        if (routeFilter) {
            routeFilter.forEach(f => url.searchParams.append('routeShortName', f));
        }
        return url.toString();
    },
    VEHICLE_DETAIL: (vehicleId: string, tripId: string) =>
        `/api/vehicle-detail?vehicleId=${encodeURIComponent(vehicleId)}&tripId=${encodeURIComponent(tripId)}`,
    RSS: (type: string) => `/api/rss?type=${encodeURIComponent(type)}`
} as const;
