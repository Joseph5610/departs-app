import { AppDeparture, GolemioDepartureItem, GolemioStopFeature, GolemioVehicleFeature } from "./types";
import { METRO_STATIONS } from "./metro-data";
import { TRANSIT_CONFIG } from "./api-utils";

/**
 * Normalizes Golemio vehicle feature to application-specific flat properties.
 * Handles both "Public" (already flat) and "Private/V2" (nested) formats.
 *
 * @param feature Raw feature from Golemio API
 * @param tripIdFallback Optional fallback trip ID
 * @returns Normalized GeoJSON Feature
 */
export function normalizeVehicleFeature(feature: GolemioVehicleFeature, tripIdFallback?: string): GolemioVehicleFeature {
    const p = feature.properties;

    // Identify format and extract core fields
    const vehicle_id = String(p.vehicle_id || p.id || `trip-${p.trip?.gtfs?.trip_id || tripIdFallback || 'unknown'}`);
    const gtfs_trip_id = p.gtfs_trip_id || p.trip?.gtfs?.trip_id || tripIdFallback;
    const route_short_name = p.route_short_name || p.gtfs_route_short_name || p.trip?.gtfs?.route_short_name;
    const route_type = p.route_type || p.gtfs_route_type || p.trip?.gtfs?.route_type;
    const trip_headsign = p.trip_headsign || p.gtfs_trip_headsign || p.trip?.gtfs?.trip_headsign;

    // Position and status data
    const bearing = p.bearing !== undefined ? p.bearing : p.last_position?.bearing;

    // DELAY FALLBACK CHAIN: Ensure delay is captured regardless of where it's nested in Golemio's various formats
    const delay = p.delay !== undefined ? p.delay : (
        p.last_position?.delay?.actual ??
        p.last_position?.delay ??
        p.trip?.delay ??
        p.trip?.gtfs?.delay ??
        null
    );

    const state_position = p.state_position || p.last_position?.state_position;

    // Extract next stop info
    const next_stop_name = p.next_stop_name ||
                          p.last_position?.next_stop?.name ||
                          p.last_position?.next_stop?.id ||
                          p.trip?.next_stop_name;

    // Metadata / Amenities
    const vehicle_descriptor = p.vehicle_descriptor || p.trip?.vehicle_descriptor || p.last_position?.vehicle_descriptor || {};

    const is_wheelchair_accessible = p.is_wheelchair_accessible ??
                                   p.trip?.wheelchair_accessible ??
                                   vehicle_descriptor.is_wheelchair_accessible;

    const is_air_conditioned = p.is_air_conditioned ??
                               p.trip?.air_conditioned ??
                               vehicle_descriptor.is_air_conditioned;

    const has_usb_chargers = p.has_usb_chargers ??
                            p.usb_chargers ??
                            vehicle_descriptor.has_usb_chargers;

    const vehicle_registration_number = p.vehicle_registration_number ??
                                      p.trip?.vehicle_registration_number ??
                                      p.last_position?.vehicle_registration_number ??
                                      vehicle_descriptor.vehicle_registration_number;

    const operator = p.operator || p.trip?.operator || vehicle_descriptor.operator || p.last_position?.operator;

    // Run and sequence data
    const run_number = p.run_number ?? p.trip?.run_number ?? p.trip?.gtfs?.run_number ?? p.last_position?.run_number ?? p.service_number ?? p.trip?.service_number;
    const last_stop_sequence = p.last_stop_sequence ?? p.last_position?.last_stop?.sequence ?? p.last_position?.last_stop_sequence;
    const origin_timestamp = p.origin_timestamp || p.last_position?.origin_timestamp || p.trip?.origin_timestamp || p.last_position?.timestamp;

    return {
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
            ...p, // Preserve any extra properties
            vehicle_id,
            gtfs_trip_id,
            trip_id: gtfs_trip_id,
            route_short_name,
            gtfs_route_short_name: route_short_name,
            route_type,
            trip_headsign,
            gtfs_trip_headsign: trip_headsign,
            bearing,
            delay,
            state_position,
            next_stop_name,
            last_stop_sequence,
            origin_timestamp,
            run_number,
            is_wheelchair_accessible,
            is_air_conditioned,
            has_usb_chargers,
            vehicle_registration_number,
            vehicle_descriptor: {
                operator,
                is_wheelchair_accessible,
                is_air_conditioned,
                has_usb_chargers,
                vehicle_registration_number,
                ...vehicle_descriptor
            }
        }
    };
}

/**
 * Deduplicates and applies circular jittering to stacked vehicles.
 * When multiple vehicles are at the exact same coordinates, they are spread out in a circle.
 *
 * @param allFeatures List of normalized vehicle features
 * @returns Deduplicated and jittered features
 */
export function processVehicleFeatures(allFeatures: GolemioVehicleFeature[]): GolemioVehicleFeature[] {
    const seen = new Set<string>();
    const uniqueFeatures: GolemioVehicleFeature[] = [];

    // Deduplicate by vehicle_id
    for (const f of allFeatures) {
        const id = String(f.properties.vehicle_id || f.properties.id || '');
        if (id && !seen.has(id)) {
            seen.add(id);
            uniqueFeatures.push(f);
        }
    }

    // Group by coordinates
    const groups: Record<string, GolemioVehicleFeature[]> = {};
    uniqueFeatures.forEach((f) => {
        const key = f.geometry.coordinates.join(',');
        if (!groups[key]) groups[key] = [];
        groups[key].push(f);
    });

    const jitteredFeatures: GolemioVehicleFeature[] = [];
    const BASE_JITTER_RADIUS = TRANSIT_CONFIG.JITTER_RADIUS;

    Object.values(groups).forEach(group => {
        if (group.length === 1) {
            jitteredFeatures.push(group[0]);
        } else {
            const count = group.length;
            const angleStep = (2 * Math.PI) / count;

            group.forEach((f, index) => {
                const [lng, lat] = f.geometry.coordinates;
                const angle = index * angleStep;

                // For many vehicles, use two concentric circles for better visibility
                let currentRadius = BASE_JITTER_RADIUS;
                if (count > 4) {
                    currentRadius = index % 2 === 0 ? BASE_JITTER_RADIUS * 0.8 : BASE_JITTER_RADIUS * 1.35;
                }

                jitteredFeatures.push({
                    ...f,
                    geometry: {
                        ...f.geometry,
                        coordinates: [
                            lng + currentRadius * Math.cos(angle) * 1.3, // Aspect ratio compensation
                            lat + currentRadius * Math.sin(angle)
                        ]
                    }
                });
            });
        }
    });

    return jitteredFeatures;
}

/**
 * Filters stop IDs for departures to avoid 400 errors from Golemio.
 * Removes parent stations and entrances if they would cause issues.
 *
 * @param stopId Comma separated stop IDs
 * @returns Array of filtered stop IDs
 */
export function filterStopIdsForDepartures(stopId: string): string[] {
    const rawIds = stopId.split(',');
    const finalIds = rawIds.filter(id => {
        if (id.includes('S')) return false; // Filter out stations (parent stations)
        if (!id.includes('Z')) return false; // Keep only platform-level stops
        return true;
    });
    return finalIds.length > 0 ? finalIds : rawIds;
}

/**
 * Normalizes departure items from Golemio API to a consistent application format.
 *
 * @param item Raw departure item
 * @returns Normalized departure object
 */
export function normalizeDeparture(item: GolemioDepartureItem): AppDeparture {
    const line = String(item.route?.short_name || '?').toUpperCase();
    const type = String(item.route?.type || (['A', 'B', 'C'].includes(line) ? '1' : '0'));
    const isMetro = type === '1' || ['A', 'B', 'C'].includes(line);

    let directionId: string | number | null | undefined = item.trip?.direction_id;

    // For Metro, we use stop ID (platform) as directionId to group by platform
    if (isMetro && item.stop?.id) {
        directionId = item.stop.id;
    }

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
        vehicleId: item.vehicle?.id,
        platform: item.stop?.platform_code || undefined
    };
}

/**
 * Groups and processes raw GTFS stops for map display.
 * Handles metro stations, stop grouping by name/platform, and centroid calculation.
 *
 * @param allStops List of all raw stop features from GTFS
 * @returns Processed features for the map
 */
export function processStops(allStops: GolemioStopFeature[]): GolemioStopFeature[] {
    // 1. Filter out internal technical stops and prepare data structures
    const stationAnchors = new Map<string, GolemioStopFeature>();
    const stationChildren = new Map<string, string[]>();
    const publicStops: GolemioStopFeature[] = [];

    for (const f of allStops) {
        const p = f.properties;
        const type = Number(p.location_type);

        // Filter: Public stops/stations MUST have a zone_id or belong to a parent station (except entrances)
        if (type !== 2 && !p.zone_id && !p.parent_station) continue;

        publicStops.push(f);

        if (type === 1) {
            stationAnchors.set(p.stop_id, f);
        } else if (p.parent_station && type !== 2) {
            if (!stationChildren.has(p.parent_station)) stationChildren.set(p.parent_station, []);
            stationChildren.get(p.parent_station)!.push(p.stop_id);
        }
    }

    const groups: Record<string, GolemioStopFeature> = {};
    const nameGroups = new Map<string, GolemioStopFeature[]>();

    // 2. Group stops and build name groups for centroids in a single pass
    for (const f of publicStops) {
        const p = f.properties;
        const type = Number(p.location_type);
        const stopId = p.stop_id;

        const metroLines = p.stop_name ? (METRO_STATIONS[p.stop_name] || []) : [];
        const isTrain = String(stopId).endsWith('Z301') ? 1 : 0;
        const enrichedProperties = {
            ...p,
            metro_lines: metroLines,
            metro_a: metroLines.includes('A') ? 1 : 0,
            metro_b: metroLines.includes('B') ? 1 : 0,
            metro_c: metroLines.includes('C') ? 1 : 0,
            is_train: isTrain,
            variant_seed: Math.random()
        };

        const enrichedFeature = { ...f, properties: enrichedProperties };

        // Collect for centroid calculation
        if (type !== 2 && p.stop_name) {
            if (!nameGroups.has(p.stop_name)) nameGroups.set(p.stop_name, []);
            nameGroups.get(p.stop_name)!.push(enrichedFeature);
        }

        // Handle Metro Stations (Type 1)
        if (type === 1) {
            const children = stationChildren.get(stopId) || [];
            groups[`metro_station_${stopId}`] = {
                ...enrichedFeature,
                properties: {
                    ...enrichedProperties,
                    location_type: 1,
                    stop_id: children.length > 0 ? children.join(',') : stopId
                }
            };
            continue;
        }

        // Handle Entrances (Type 2)
        if (type === 2) {
            groups[`entrance_${stopId}`] = {
                ...f,
                properties: { ...p, location_type: 2 }
            };
            continue;
        }

        // Handle Regular Stops (Type 0)
        if (type === 0 || isNaN(type)) {
            // Skip if it belongs to a known metro station anchor (handled above)
            if (p.parent_station && stationAnchors.has(p.parent_station)) continue;
            if (!p.stop_name) continue;

            // Group by name and platform code
            const key = `stop_${p.stop_name.toLowerCase()}_${p.platform_code || ''}`;
            if (!groups[key]) {
                groups[key] = {
                    ...enrichedFeature,
                    properties: {
                        ...enrichedProperties,
                        location_type: 0,
                        all_ids: [stopId]
                    }
                };
            } else {
                const currentIds = groups[key].properties.all_ids || [];
                groups[key].properties.all_ids = [...currentIds, stopId];
            }
        }
    }

    // 3. Prepare final features list
    const features: GolemioStopFeature[] = [];

    // Add grouped stops
    for (const f of Object.values(groups)) {
        const finalId = f.properties.all_ids ? f.properties.all_ids.join(',') : f.properties.stop_id;
        features.push({
            type: "Feature",
            geometry: f.geometry,
            properties: { ...f.properties, stop_id: finalId }
        });
    }

    // 4. Calculate centroids for each stop name group
    for (const [, groupFeatures] of nameGroups) {
        // Preference: If there's a station (type 1) in the group, use it as the centroid anchor
        const station = groupFeatures.find(f => Number(f.properties.location_type) === 1);

        if (station) {
            features.push({
                type: "Feature",
                geometry: station.geometry,
                properties: {
                    ...station.properties,
                    is_centroid: true,
                    stop_id: `centroid-${station.properties.stop_id}`
                }
            });
        } else {
            // Otherwise, calculate average coordinates
            let sumLng = 0;
            let sumLat = 0;
            for (const f of groupFeatures) {
                sumLng += f.geometry.coordinates[0];
                sumLat += f.geometry.coordinates[1];
            }
            const avgLng = sumLng / groupFeatures.length;
            const avgLat = sumLat / groupFeatures.length;

            features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [avgLng, avgLat] },
                properties: {
                    ...groupFeatures[0].properties,
                    is_centroid: true,
                    stop_id: `centroid-${groupFeatures[0].properties.stop_id}`
                }
            });
        }
    }

    return features;
}
