import { Env, GolemioStopFeature, GolemioStopPayload, AppStopFeature, AppStopProperties } from "../_utils/types";
import { CACHE_TTL, TRANSIT_CONFIG, ERROR_MESSAGES, golemioFetch, createErrorResponse, createSuccessResponse, fixCommaSpacing } from "../_utils/api-utils";
import { getVehicleColor } from "../_utils/vehicle-colors";
import { getStopEnrichment } from "../_utils/enrichment";


/**
 * Groups and processes enriched stops for map display.
 * Input is already AppStopFeature[] (enriched with lines from our enrichment layer).
 */
export function processStops(allStops: AppStopFeature[]): AppStopFeature[] {
    const stationAnchors = new Map<string, AppStopFeature>();
    const stationChildren = new Map<string, string[]>();
    const stationChildrenFeatures = new Map<string, AppStopFeature[]>();
    const publicStops: AppStopFeature[] = [];
    for (const f of allStops) {
        const p = f.properties;
        const type = Number(p.location_type);
        if (type !== 2 && !p.zone_id && !p.parent_station) continue;
        publicStops.push(f);
        if (type === 1) {
            stationAnchors.set(p.stop_id, f);
        } else if (p.parent_station) {
            if (!stationChildrenFeatures.has(p.parent_station)) stationChildrenFeatures.set(p.parent_station, []);
            stationChildrenFeatures.get(p.parent_station)!.push(f);
            
            if (type !== 2) {
                if (!stationChildren.has(p.parent_station)) stationChildren.set(p.parent_station, []);
                stationChildren.get(p.parent_station)!.push(p.stop_id);
            }
        }
    }

    const groups = new Map<string, AppStopFeature>();
    const nameGroups = new Map<string, AppStopFeature[]>();

    for (const f of publicStops) {
        const p = f.properties;
        const type = Number(p.location_type);
        const stopId = p.stop_id;
        const lines: NonNullable<AppStopProperties['lines']> = p.lines ?? [];
        const metroLines = Array.from(new Set(lines.filter(l => String(l.type) === 'metro').map(l => l.name))).sort();
        const isTrain: 0 | 1 = lines.some(l => String(l.type) === 'train' || String(l.type) === 'rail') ? 1 : 0;
        const stopName = fixCommaSpacing(p.stop_name) || p.stop_name;

        const enrichedProperties: AppStopProperties = {
            stop_id: stopId,
            stop_name: stopName,
            platform_code: p.platform_code ?? null,
            location_type: type,
            parent_station: p.parent_station ?? null,
            zone_id: p.zone_id ?? null,
            is_train: isTrain,
            metro_a: metroLines.includes('A') ? 1 : 0,
            metro_b: metroLines.includes('B') ? 1 : 0,
            metro_c: metroLines.includes('C') ? 1 : 0,
            metro_lines: metroLines.length > 0 ? metroLines.map(name => ({ name, route_color: getVehicleColor('metro', name) })) : undefined,
            metro_color: metroLines.length > 0 ? getVehicleColor('metro', metroLines[0]) : undefined,
            metro_color_2: metroLines.length > 1 ? getVehicleColor('metro', metroLines[1]) : undefined,
            lines: lines.map(l => ({ name: l.name, type: l.type, route_color: getVehicleColor(String(l.type), l.name) }))
        };

        const nodeIdMatch = stopId.match(/^([A-Za-z]*\d+)/);
        const nodeId = nodeIdMatch ? nodeIdMatch[1] : stopId;
        const enrichedFeature: AppStopFeature = { type: 'Feature', geometry: f.geometry, properties: enrichedProperties };

        if ((type === 0 || type === 1 || isNaN(type)) && p.stop_name) {
            const centroidKey = `${stopName}_${nodeId}`;
            if (!nameGroups.has(centroidKey)) nameGroups.set(centroidKey, []);
            nameGroups.get(centroidKey)!.push(enrichedFeature);
        }

        if (type === 1) {
            const childrenList = stationChildren.get(stopId) || [];
            const childFeatures = stationChildrenFeatures.get(stopId) || [];
            const allChildLines: NonNullable<AppStopProperties['lines']> = childFeatures.flatMap(cf => cf.properties.lines ?? []);
            const aggregatedMetroLines = Array.from(new Set(allChildLines.filter(l => String(l.type) === 'metro').map(l => l.name))).sort();
            const aggregatedIsTrain: 0 | 1 = allChildLines.some(l => String(l.type) === 'train' || String(l.type) === 'rail') ? 1 : 0;

            let finalGeometry = enrichedFeature.geometry;
            if (childFeatures.length > 0) {
                let sumLng = 0, sumLat = 0;
                for (const child of childFeatures) { sumLng += child.geometry.coordinates[0]; sumLat += child.geometry.coordinates[1]; }
                finalGeometry = { type: "Point", coordinates: [sumLng / childFeatures.length, sumLat / childFeatures.length] };
            }

            groups.set(`metro_station_${stopId}`, {
                type: 'Feature', geometry: finalGeometry,
                properties: {
                    ...enrichedProperties,
                    lines: Array.from(new Map(allChildLines.map(l => [`${l.name}_${l.type}`, { name: l.name, type: l.type, route_color: getVehicleColor(String(l.type), l.name) }])).values()),
                    metro_lines: aggregatedMetroLines.map(name => ({ name, route_color: getVehicleColor('metro', name) })),
                    metro_color: aggregatedMetroLines.length > 0 ? getVehicleColor('metro', aggregatedMetroLines[0]) : undefined,
                    metro_color_2: aggregatedMetroLines.length > 1 ? getVehicleColor('metro', aggregatedMetroLines[1]) : undefined,
                    metro_a: aggregatedMetroLines.includes('A') ? 1 : 0,
                    metro_b: aggregatedMetroLines.includes('B') ? 1 : 0,
                    metro_c: aggregatedMetroLines.includes('C') ? 1 : 0,
                    is_train: (aggregatedIsTrain || isTrain) as 0 | 1,
                    location_type: 1,
                    stop_id: childrenList.length > 0 ? childrenList.join(',') : stopId
                }
            });
            continue;
        }

        if (type === 2) {
            groups.set(`entrance_${stopId}`, { type: 'Feature', geometry: f.geometry, properties: { ...enrichedProperties, location_type: 2 } });
            continue;
        }

        if (type === 0 || isNaN(type)) {
            if (p.parent_station && stationAnchors.has(p.parent_station)) continue;
            if (!p.stop_name) continue;
            const key = `stop_${stopName.toLowerCase()}_${nodeId}_${p.platform_code || ''}`;
            const existing = groups.get(key);
            if (!existing) {
                groups.set(key, { type: 'Feature', geometry: f.geometry, properties: { ...enrichedProperties, all_ids: [stopId] } });
            } else {
                existing.properties.all_ids = [...(existing.properties.all_ids || []), stopId];
            }
        }
    }

    const features: AppStopFeature[] = [];

    for (const f of groups.values()) {
        const allIds = f.properties.all_ids;
        const finalId = allIds && allIds.length > 0 ? allIds.join(',') : f.properties.stop_id;
        features.push({ ...f, properties: { ...f.properties, stop_id: finalId } });
    }

    for (const groupFeatures of nameGroups.values()) {
        const station = groupFeatures.find(f => Number(f.properties.location_type) === 1);
        const baseFeature = station || groupFeatures[0];
        let sumLng = 0, sumLat = 0;
        for (const f of groupFeatures) { sumLng += f.geometry.coordinates[0]; sumLat += f.geometry.coordinates[1]; }
        const allMetroNames = Array.from(new Set(groupFeatures.flatMap(f => (f.properties.metro_lines || []).map(m => m.name))));
        const aggregatedIsTrain: 0 | 1 = groupFeatures.some(f => f.properties.is_train === 1) ? 1 : 0;
        const centroidId = `centroid-${baseFeature.properties.stop_id}`;

        features.push({
            type: "Feature", id: centroidId,
            geometry: { type: "Point", coordinates: [sumLng / groupFeatures.length, sumLat / groupFeatures.length] },
            properties: {
                ...baseFeature.properties,
                metro_lines: allMetroNames.map(name => ({ name, route_color: getVehicleColor('metro', name) })),
                metro_a: allMetroNames.includes('A') ? 1 : 0,
                metro_b: allMetroNames.includes('B') ? 1 : 0,
                metro_c: allMetroNames.includes('C') ? 1 : 0,
                is_train: aggregatedIsTrain,
                is_centroid: true,
                stop_id: centroidId
            }
        });
    }

    return features;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    const fetchAllGolemioStops = async (): Promise<GolemioStopFeature[]> => {
        const limit = TRANSIT_CONFIG.STOPS_FETCH_LIMIT;
        const maxOffset = TRANSIT_CONFIG.STOPS_MAX_OFFSET;
        const pageCount = Math.ceil(maxOffset / limit);
        const offsets = Array.from({ length: pageCount }, (_, i) => i * limit);
        const results = await Promise.all(offsets.map(async (offset) => {
            const res = await golemioFetch("/v2/gtfs/stops", env, {
                cacheTtl: CACHE_TTL.GTFS_DATA,
                searchParams: { limit: limit.toString(), offset: offset.toString() }
            });
            if (!res.ok) return [];
            const data = await res.json() as GolemioStopPayload;
            return data.features || [];
        }));
        return results.flat();
    };

    try {
        const allRawStops = await fetchAllGolemioStops();
        if (allRawStops.length === 0) return createErrorResponse(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);

        // Enrich raw Golemio stops → AppStopFeature[] (adds lines, names from our enrichment data)
        const enrichedStops: AppStopFeature[] = allRawStops
            .filter(f => {
                const enrichment = getStopEnrichment(f.properties.stop_id);
                if (!enrichment) return true;
                return enrichment.l && enrichment.l.some(l => l.e === 0);
            })
            .map(f => {
                const enrichment = getStopEnrichment(f.properties.stop_id);
                const lines: NonNullable<AppStopProperties['lines']> = enrichment
                    ? enrichment.l.map(l => ({ name: l.n, type: l.t, route_color: getVehicleColor(l.t, l.n) }))
                    : [];
                return {
                    type: 'Feature' as const,
                    geometry: f.geometry,
                    properties: {
                        stop_id: f.properties.stop_id,
                        stop_name: enrichment?.n || f.properties.stop_name,
                        location_type: f.properties.location_type,
                        parent_station: f.properties.parent_station ?? null,
                        platform_code: f.properties.platform_code ?? null,
                        zone_id: f.properties.zone_id ?? null,
                        lines
                    }
                };
            });

        const features = processStops(enrichedStops);
        return createSuccessResponse({ type: "FeatureCollection", features }, CACHE_TTL.STOPS);
    } catch (error) {
        console.error("Stops API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
