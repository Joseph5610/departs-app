/**
 * Every React Query key in one place, so a reader of the cache (e.g. a share reading the board's departures)
 * cannot drift from the query that writes it. Persisted queries keep their strings: changing one drops the device cache.
 */
export const queryKeys = {
    cities: () => ['cities', 'v2'] as const,
    coverage: (city: string) => ['coverage', city] as const,
    stops: (city: string, version: number | string) => ['stops', city, version] as const,
    routeMetadata: (city: string) => ['route-metadata', city] as const,
    vehicleMetadata: (city: string, file: string | undefined) => ['vehicle-metadata', city, file] as const,
    pointsOfSale: (city: string) => ['pointsOfSale', city] as const,
    vehicles: (city: string) => ['vehicles', city] as const,
    vehicleDetail: (city: string, vehicleId: string | null, tripId: string | null, fleetUpdatedAt: number) => ['vehicle-detail', city, vehicleId, tripId, fleetUpdatedAt] as const,
    departures: (city: string, stopId: string | null) => ['departures', city, stopId] as const,
    boardDepartures: (city: string, stopId: string) => ['departures', 'board', city, stopId] as const,
    /** Sorted, so reordering favourites does not refetch. */
    favoriteDepartures: (city: string, stopIds: string[]) => ['departures', 'bulk', city, [...stopIds].sort().join(',')] as const,
    alerts: (city: string) => ['alerts', city] as const,
    infotexts: (city: string) => ['infotexts', city] as const,
    geocoding: (url: string | null) => ['geocoding', url] as const,
    tripShapeIds: (city: string, bucket: string | undefined) => ['trip-shape-ids', city, bucket] as const,
    tripShapeGeometry: (city: string, bucket: string | undefined) => ['trip-shape-geometry', city, bucket] as const,
};
