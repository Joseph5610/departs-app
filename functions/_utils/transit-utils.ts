import { AppDeparture, GolemioDepartureItem, GolemioStopFeature, GolemioVehicleFeature } from "./types";
import { METRO_STATIONS } from "./metro-data";
import { TRANSIT_CONFIG } from "./api-utils";
import { getVehicleColor, isNightRoute, VEHICLE_COLORS } from "./vehicle-colors";

/**
 * Fixes missing spaces after commas (common in Golemio data).
 * e.g., "Tuchoměřice,Špejchar" -> "Tuchoměřice, Špejchar"
 */
function fixCommaSpacing(text: string | undefined | null): string | undefined {
    if (!text) return text as any;
    return text.replace(/,([^\s])/g, ', $1');
}

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
    const vehicle_id = p.vehicle_id !== undefined && p.vehicle_id !== null ? String(p.vehicle_id) : (p.id !== undefined && p.id !== null ? String(p.id) : undefined);
    const gtfs_trip_id = p.gtfs_trip_id || p.trip?.gtfs?.trip_id || tripIdFallback;
    const route_short_name = p.route_short_name || p.gtfs_route_short_name || p.trip?.gtfs?.route_short_name;
    const route_type = p.route_type || p.gtfs_route_type || p.trip?.gtfs?.route_type;
    const trip_headsign = fixCommaSpacing(p.trip_headsign || p.gtfs_trip_headsign || p.trip?.gtfs?.trip_headsign);

    // Position and status data
    const last_pos = p.last_position;
    const trip = p.trip;

    const bearing = p.bearing !== undefined ? p.bearing : last_pos?.bearing;
    const delay = p.delay !== undefined ? p.delay : (typeof last_pos?.delay === 'object' ? last_pos?.delay?.actual : last_pos?.delay) ?? 0;
    const state_position = p.state_position || last_pos?.state_position;

    // Extract next stop info - check various nested structures used by Golemio
    const next_stop_name = fixCommaSpacing(p.next_stop_name ||
                          last_pos?.next_stop?.name ||
                          last_pos?.next_stop?.id ||
                          trip?.next_stop_name);

    // Metadata / Amenities
    const vehicle_descriptor = (p.vehicle_descriptor || trip?.vehicle_descriptor || last_pos?.vehicle_descriptor || {});

    const is_wheelchair_accessible = p.is_wheelchair_accessible ??
                                   trip?.wheelchair_accessible ??
                                   vehicle_descriptor.is_wheelchair_accessible;

    const is_air_conditioned = p.is_air_conditioned ??
                               trip?.air_conditioned ??
                               vehicle_descriptor.is_air_conditioned;

    const has_usb_chargers = (p.has_usb_chargers as boolean | undefined) ??
                            (p.usb_chargers as boolean | undefined) ??
                            vehicle_descriptor.has_usb_chargers;

    const vehicle_registration_number = p.vehicle_registration_number ??
                                      trip?.vehicle_registration_number ??
                                      last_pos?.vehicle_registration_number ??
                                      vehicle_descriptor.vehicle_registration_number;

    const operator = (p.operator as string | undefined) || trip?.operator || vehicle_descriptor.operator || last_pos?.operator;

    // Run and sequence data
    const run_number = p.run_number ?? trip?.run_number ?? trip?.gtfs?.run_number ?? last_pos?.run_number ?? p.service_number ?? trip?.service_number;
    const last_stop_sequence = (p.last_stop_sequence as number | undefined) ?? last_pos?.last_stop?.sequence ?? last_pos?.last_stop_sequence;
    const origin_timestamp = (p.origin_timestamp as string | undefined) || last_pos?.origin_timestamp || trip?.origin_timestamp || last_pos?.timestamp;

    const line_color = getVehicleColor(route_type, route_short_name);
    const is_night = isNightRoute(route_short_name);

    return {
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
            vehicle_id,
            gtfs_trip_id,
            route_short_name,
            route_type,
            trip_headsign,
            bearing,
            delay,
            state_position,
            next_stop_name,
            last_stop_sequence,
            origin_timestamp,
            run_number,
            line_color,
            is_night,
            vehicle_descriptor: {
                operator,
                vehicle_type: (p.vehicle_type as string | undefined) || p.trip?.vehicle_type || vehicle_descriptor.vehicle_type,
                is_wheelchair_accessible,
                is_air_conditioned,
                has_usb_chargers,
                vehicle_registration_number
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
        headsign: fixCommaSpacing(item.trip?.headsign) || 'Unknown',
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
 * Optimized for memory efficiency and robustness against large datasets.
 *
 * @param allStops List of all raw stop features from GTFS
 * @returns Processed features for the map
 */
export function processStops(allStops: GolemioStopFeature[]): GolemioStopFeature[] {
    const stationAnchors = new Map<string, GolemioStopFeature>();
    const stationChildren = new Map<string, string[]>();

    // Pass 1: Build station/hierarchy relationships
    for (const f of allStops) {
        const p = f.properties;
        const type = Number(p.location_type);
        const stopId = p.stop_id;

        if (type === 1) {
            stationAnchors.set(stopId, f);
        } else if (p.parent_station && type !== 2) {
            let children = stationChildren.get(p.parent_station);
            if (!children) {
                children = [];
                stationChildren.set(p.parent_station, children);
            }
            children.push(stopId);
        }
    }

    const groups: Record<string, any> = {};
    const nameGroups = new Map<string, any[]>();

    // Pass 2: Filter, Enrich, and Group
    for (const f of allStops) {
        const p = f.properties;
        const type = Number(p.location_type);
        const stopId = p.stop_id;

        // Skip non-public or technical stops
        if (type !== 2 && !p.zone_id && !p.parent_station) continue;

        const rawStopName = p.stop_name || "Unknown";
        const stopName = fixCommaSpacing(rawStopName)!;
        const metroLines = METRO_STATIONS[stopName] || [];
        const isTrain = String(stopId).endsWith('Z301') ? 1 : 0;

        let stopColor: string = VEHICLE_COLORS.STOP_DEFAULT;
        let transferIcon = '';

        if (type === 1) {
            if (stopName === 'Můstek') transferIcon = 'transfer-A-B';
            else if (stopName === 'Muzeum') transferIcon = 'transfer-A-C';
            else if (stopName === 'Florenc') transferIcon = 'transfer-B-C';

            if (transferIcon) {
                stopColor = '#ffffff';
            } else if (metroLines.includes('A')) {
                stopColor = VEHICLE_COLORS.METRO_A;
            } else if (metroLines.includes('B')) {
                stopColor = VEHICLE_COLORS.METRO_B;
            } else if (metroLines.includes('C')) {
                stopColor = VEHICLE_COLORS.METRO_C;
            } else {
                stopColor = '#38bdf8';
            }
        } else if (isTrain) {
            stopColor = VEHICLE_COLORS.TRAIN;
        }

        // Lean properties to minimize memory footprint in the final JSON response
        const props: any = {
            stop_id: stopId,
            stop_name: stopName,
            location_type: type,
            variant_seed: Math.round(Math.random() * 1000) / 1000
        };

        if (p.platform_code) props.platform_code = p.platform_code;
        if (p.parent_station) props.parent_station = p.parent_station;
        if (p.zone_id) props.zone_id = p.zone_id;

        if (metroLines.length > 0) {
            props.metro_lines = metroLines;
            if (metroLines.includes('A')) props.metro_a = 1;
            if (metroLines.includes('B')) props.metro_b = 1;
            if (metroLines.includes('C')) props.metro_c = 1;
        }

        if (isTrain) props.is_train = 1;
        if (stopColor !== VEHICLE_COLORS.STOP_DEFAULT) props.stop_color = stopColor;
        if (transferIcon) props.transfer_icon = transferIcon;

        const feature: any = {
            type: "Feature",
            geometry: f.geometry,
            properties: props
        };

        // Collect features for name-based centroids (search markers)
        if (type !== 2) {
            let nGroup = nameGroups.get(stopName);
            if (!nGroup) {
                nGroup = [];
                nameGroups.set(stopName, nGroup);
            }
            nGroup.push(feature);
        }

        // Handle logical grouping
        if (type === 1) {
            // Stations (Metro)
            const children = stationChildren.get(stopId);
            if (children && children.length > 0) {
                feature.properties.stop_id = children.join(',');
            }
            groups[`m_${stopId}`] = feature;
            continue;
        }

        if (type === 2) {
            // Entrances
            groups[`e_${stopId}`] = feature;
            continue;
        }

        // Regular stops (Type 0)
        if (p.parent_station && stationAnchors.has(p.parent_station)) continue;

        const groupKey = `s_${stopName.toLowerCase()}_${p.platform_code || ''}`;
        const existing = groups[groupKey];
        if (!existing) {
            feature.properties.all_ids = [stopId];
            groups[groupKey] = feature;
        } else {
            existing.properties.all_ids.push(stopId);
        }
    }

    const result: GolemioStopFeature[] = [];

    // Finalize grouped stops and convert all_ids to comma-separated string if needed
    for (const key in groups) {
        const f = groups[key];
        if (f.properties.all_ids) {
            f.properties.stop_id = f.properties.all_ids.join(',');
            // We keep all_ids for now as it might be used by the frontend
        }
        result.push(f);
    }

    // Pass 3: Create Centroids
    for (const [name, groupFeatures] of nameGroups) {
        const station = groupFeatures.find(f => f.properties.location_type === 1);
        if (station) {
            result.push({
                type: "Feature",
                geometry: station.geometry,
                properties: {
                    ...station.properties,
                    is_centroid: true,
                    stop_id: `centroid-${station.properties.stop_id}`
                }
            } as any);
        } else {
            let sumLng = 0, sumLat = 0;
            for (const f of groupFeatures) {
                sumLng += f.geometry.coordinates[0];
                sumLat += f.geometry.coordinates[1];
            }
            const count = groupFeatures.length;
            result.push({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [sumLng / count, sumLat / count]
                },
                properties: {
                    ...groupFeatures[0].properties,
                    is_centroid: true,
                    stop_id: `centroid-${groupFeatures[0].properties.stop_id}`
                }
            } as any);
        }
    }

    return result;
}
