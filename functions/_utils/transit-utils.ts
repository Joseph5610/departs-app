/**
 * Common transit data processing utilities for the backend.
 */

/**
 * Normalizes vehicle ID and ensures it's a string.
 */
export const normalizeVehicleId = (f: any): string => {
    return String(f.properties.vehicle_id || f.properties.id || '');
};

/**
 * Applies circular jittering to coordinates that are exactly the same.
 * This prevents vehicles from perfectly overlapping on the map.
 */
export const applyJitter = (allFeatures: any[]): any[] => {
    const seen = new Set<string>();
    const uniqueFeatures: any[] = [];

    for (const f of allFeatures) {
        const id = normalizeVehicleId(f);
        if (id && !seen.has(id)) {
            seen.add(id);
            uniqueFeatures.push(f);
        }
    }

    const groups: Record<string, any[]> = {};
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
 */
export const normalizeVehicleFeature = (feature: any, tripId?: string | null): any => {
    return {
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
            vehicle_id: feature.properties.vehicle_id || (tripId ? `trip-${tripId}` : `trip-${feature.properties.trip?.gtfs?.trip_id || 'unknown'}`),
            gtfs_trip_id: feature.properties.trip?.gtfs?.trip_id || tripId,
            trip_id: feature.properties.trip?.gtfs?.trip_id || tripId,
            route_short_name: feature.properties.trip?.gtfs?.route_short_name,
            gtfs_route_short_name: feature.properties.trip?.gtfs?.route_short_name,
            route_type: feature.properties.trip?.gtfs?.route_type,
            trip_headsign: feature.properties.trip?.gtfs?.trip_headsign,
            gtfs_trip_headsign: feature.properties.trip?.gtfs?.trip_headsign,
            bearing: feature.properties.last_position?.bearing,
            delay: feature.properties.last_position?.delay?.actual || 0,
            state_position: feature.properties.last_position?.state_position,
            next_stop_name: feature.properties.last_position?.next_stop?.id,
            is_wheelchair_accessible: feature.properties.trip?.wheelchair_accessible,
            is_air_conditioned: feature.properties.trip?.air_conditioned,
            vehicle_registration_number: feature.properties.trip?.vehicle_registration_number,
        }
    };
};

/**
 * Normalizes a Golemio departure item into our internal format.
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
