/**
 * Common transit data processing utilities for the backend.
 */

/**
 * Normalizes vehicle ID and ensures it's a string.
 */
export const normalizeVehicleId = (f: { properties: Record<string, unknown> }): string => {
    return String(f.properties.vehicle_id || f.properties.id || '');
};

/**
 * Applies circular jittering to coordinates that are exactly the same.
 * This prevents vehicles from perfectly overlapping on the map.
 *
 * When multiple vehicles are at the same location (e.g. at a depot or a busy terminal),
 * they are distributed in a small circle around the original point so they are
 * individually clickable and visible on the map.
 */
export const applyJitter = (allFeatures: Array<{ geometry: { coordinates: number[] }, properties: Record<string, unknown> }>): any[] => {
    const seen = new Set<string>();
    const uniqueFeatures: Array<{ geometry: { coordinates: number[] }, properties: Record<string, unknown> }> = [];

    for (const f of allFeatures) {
        const id = normalizeVehicleId(f);
        if (id && !seen.has(id)) {
            seen.add(id);
            uniqueFeatures.push(f);
        }
    }

    // Group features by their exact coordinates
    const groups: Record<string, Array<{ geometry: { coordinates: number[] }, properties: Record<string, unknown> }>> = {};
    uniqueFeatures.forEach((f) => {
        const key = f.geometry.coordinates.join(',');
        if (!groups[key]) groups[key] = [];
        groups[key].push(f);
    });

    const jitteredFeatures: any[] = [];
    const BASE_JITTER_RADIUS = 0.00012;

    Object.values(groups).forEach(group => {
        if (group.length === 1) {
            jitteredFeatures.push(group[0]);
        } else {
            const count = group.length;
            const angleStep = (2 * Math.PI) / count;

            group.forEach((f, index) => {
                const [lng, lat] = f.geometry.coordinates;
                const angle = index * angleStep;
                let currentRadius = BASE_JITTER_RADIUS;
                if (count > 4) {
                    currentRadius = index % 2 === 0 ? BASE_JITTER_RADIUS * 0.8 : BASE_JITTER_RADIUS * 1.35;
                }

                jitteredFeatures.push({
                    ...f,
                    geometry: {
                        ...f.geometry,
                        coordinates: [
                            lng + currentRadius * Math.cos(angle) * 1.3,
                            lat + currentRadius * Math.sin(angle)
                        ]
                    }
                });
            });
        }
    });

    return jitteredFeatures;
};

/**
 * Normalizes a Golemio vehicle feature into our internal flat format.
 *
 * This ensures the frontend receives a consistent set of properties
 * regardless of which Golemio API endpoint was used (Public vs Standard).
 */
export const normalizeVehicleFeature = (feature: { geometry: unknown, properties: any }, tripId?: string | null): any => {
    const p = feature.properties;

    const vehicle_id = String(p.vehicle_id || p.id || (tripId ? `trip-${tripId}` : `trip-${p.trip?.gtfs?.trip_id || 'unknown'}`));

    return {
        type: 'Feature',
        id: vehicle_id,
        geometry: feature.geometry,
        properties: {
            ...p, // Comprehensive: include all original Golemio properties
            vehicle_id: vehicle_id,
            // Maintain common flat keys for backward compatibility and MapLibre expression ease
            // These keys are used in src/config/mapLayers.ts and src/utils/vehicleColors.ts
            gtfs_trip_id: p.trip?.gtfs?.trip_id ?? tripId ?? undefined,
            trip_id: p.trip?.gtfs?.trip_id ?? tripId ?? undefined,
            route_short_name: p.trip?.gtfs?.route_short_name ?? undefined,
            gtfs_route_short_name: p.trip?.gtfs?.route_short_name ?? undefined,
            route_type: p.trip?.gtfs?.route_type ?? undefined,
            trip_headsign: p.trip?.gtfs?.trip_headsign ?? undefined,
            gtfs_trip_headsign: p.trip?.gtfs?.trip_headsign ?? undefined,
            bearing: p.last_position?.bearing,
            delay: p.last_position?.delay?.actual || 0,
        }
    };
};

/**
 * Normalizes a Golemio departure item into our internal format.
 *
 * Handles Metro-specific grouping logic by using platform IDs as direction indicators,
 * ensuring that all departures from the same platform group together in the UI.
 */
export const normalizeDepartureItem = (item: any): any => {
    const line = String(item.route?.short_name || '?').toUpperCase();
    const type = String(item.route?.type || (['A', 'B', 'C'].includes(line) ? '1' : '0'));
    const isMetro = type === '1' || ['A', 'B', 'C'].includes(line);

    let directionId: string | number | null | undefined = item.trip?.direction_id;

    // For Metro, we use the specific Stop ID (platform ID) as the primary direction indicator.
    // This ensures all trips from the same platform (full or shortened) group together.
    if (isMetro && item.stop?.id) {
        directionId = item.stop.id;
    }

    // Fallback for missing data
    if (directionId === undefined || directionId === null) {
        directionId = item.trip?.direction_id ?? item.stop?.platform_code ?? item.trip?.headsign ?? '0';
    }

    return {
        timestamp: item.departure.timestamp_predicted || item.departure.timestamp_scheduled,
        scheduled: item.departure.timestamp_scheduled,
        delay: item.departure.delay_seconds || 0,
        line,
        type,
        directionId: String(directionId),
        headsign: item.trip?.headsign || 'Unknown',
        isCanceled: item.trip?.is_canceled || false,
        tripId: item.trip?.id,
        vehicleId: item.vehicle?.id
    };
};

/**
 * Filter for stop IDs to avoid technical or redundant boarding points.
 * Keeps only those that are likely to be actual passenger stops.
 */
export const isValidStopId = (id: string): boolean => {
    if (id.includes('S')) return false; // Stations/Entrances (as a whole)
    if (!id.includes('Z')) return false; // 'Z' typically stands for 'Zastávka' (Stop)
    return true;
};

/**
 * Calculates the geo-average (centroid) of multiple features.
 */
export const calculateCentroid = (features: any[]): [number, number] => {
    let sumLng = 0;
    let sumLat = 0;
    features.forEach(f => {
        sumLng += f.geometry.coordinates[0];
        sumLat += f.geometry.coordinates[1];
    });
    return [sumLng / features.length, sumLat / features.length];
};

/**
 * Hardcoded mapping of Metro stations to their respective lines.
 * Used for visual grouping and coloring in the UI.
 */
export const METRO_STATIONS: Record<string, string[]> = {
    // Line A (Green)
    "Nemocnice Motol": ["A"], "Petřiny": ["A"], "Nádraží Veleslavín": ["A"], "Bořislavka": ["A"],
    "Dejvická": ["A"], "Hradčanská": ["A"], "Malostranská": ["A"], "Staroměstská": ["A"],
    "Náměstí Míru": ["A"], "Jiřího z Poděbrad": ["A"], "Flora": ["A"], "Želivského": ["A"],
    "Strašnická": ["A"], "Skalka": ["A"], "Depo Hostivař": ["A"],

    // Line B (Yellow)
    "Zličín": ["B"], "Stodůlky": ["B"], "Luka": ["B"], "Lužiny": ["B"], "Hůrka": ["B"],
    "Nové Butovice": ["B"], "Jinonice": ["B"], "Radlická": ["B"], "Smíchovské nádraží": ["B"],
    "Anděl": ["B"], "Karlovo náměstí": ["B"], "Národní třída": ["B"], "Náměstí Republiky": ["B"],
    "Křižíkova": ["B"], "Invalidovna": ["B"], "Palmovka": ["B"], "Českomoravská": ["B"],
    "Vysočanská": ["B"], "Kolbenova": ["B"], "Hloubětín": ["B"], "Rajská zahrada": ["B"], "Černý Most": ["B"],

    // Line C (Red)
    "Letňany": ["C"], "Prosek": ["C"], "Střížkov": ["C"], "Ládví": ["C"], "Kobylisy": ["C"],
    "Nádraží Holešovice": ["C"], "Vltavská": ["C"], "Hlavní nádraží": ["C"], "I. P. Pavlova": ["C"],
    "Vyšehrad": ["C"], "Pražského povstání": ["C"], "Pankrác": ["C"], "Budějovická": ["C"],
    "Kačerov": ["C"], "Roztyly": ["C"], "Chodov": ["C"], "Opatov": ["C"], "Háje": ["C"],

    // Transfers
    "Můstek": ["A", "B"],
    "Muzeum": ["A", "C"],
    "Florenc": ["B", "C"]
};
