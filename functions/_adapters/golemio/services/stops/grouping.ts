import { AppStopFeature, AppStopProperties } from "../../../../_core/types";
import { getVehicleColor } from "../../services/vehicles/colors";
import { fixCommaSpacing } from "../../../../_core/api-utils";

/**
 * Processes and groups raw GTFS stop features into structural parent stations and logical centroids.
 * 
 * GTFS Location Types:
 * - 0: Stop/Platform
 * - 1: Station
 * - 2: Entrance/Exit
 *
 * Algorithm:
 * 1. Two-phase structural grouping (identifying Type 1 parents and Type 2 entrances).
 * 2. Logical enrichment (computing aggregated lines, colors, train presence).
 * 3. Centroid generation (creating virtual `is_centroid` nodes for UI map labels).
 *
 * @param allStops Raw GTFS stop features
 * @returns Grouped, enriched, and centroid-injected features
 */
interface HierarchyContext {
    stationAnchors: Map<string, AppStopFeature>;
    stationChildren: Map<string, string[]>;
    stationChildrenFeatures: Map<string, AppStopFeature[]>;
    publicStops: AppStopFeature[];
}

function buildStructuralHierarchy(allStops: AppStopFeature[]): HierarchyContext {
    const ctx: HierarchyContext = {
        stationAnchors: new Map(),
        stationChildren: new Map(),
        stationChildrenFeatures: new Map(),
        publicStops: []
    };
    
    for (const f of allStops) {
        const p = f.properties;
        const type = Number(p.location_type);
        if (type !== 2 && !p.zone_id && !p.parent_station) continue;
        
        ctx.publicStops.push(f);
        
        if (type === 1) {
            ctx.stationAnchors.set(p.stop_id, f);
        } else if (p.parent_station) {
            let features = ctx.stationChildrenFeatures.get(p.parent_station);
            if (!features) {
                features = [];
                ctx.stationChildrenFeatures.set(p.parent_station, features);
            }
            features.push(f);
            
            if (type !== 2) {
                let children = ctx.stationChildren.get(p.parent_station);
                if (!children) {
                    children = [];
                    ctx.stationChildren.set(p.parent_station, children);
                }
                children.push(p.stop_id);
            }
        }
    }
    return ctx;
}

interface EnrichmentContext {
    groups: Map<string, AppStopFeature>;
    nameGroups: Map<string, AppStopFeature[]>;
}

function enrichPublicStops(ctx: HierarchyContext): EnrichmentContext {
    const groups = new Map<string, AppStopFeature>();
    const nameGroups = new Map<string, AppStopFeature[]>();

    for (const f of ctx.publicStops) {
        const p = f.properties;
        const type = Number(p.location_type);
        const stopId = p.stop_id;
        const lines: NonNullable<AppStopProperties['lines']> = p.lines ?? [];
        
        let isTrain = 0;
        const metroSet = new Set<string>();
        
        for (const l of lines) {
            const t = String(l.type);
            if (t === 'metro') {
                metroSet.add(l.name);
            } else if (t === 'train' || t === 'rail') {
                isTrain = 1;
            }
        }
        
        const metroLines = Array.from(metroSet).sort();
        const stopName = fixCommaSpacing(p.stop_name) || p.stop_name;

        const enrichedProperties: AppStopProperties = {
            stop_id: stopId,
            stop_name: stopName,
            platform_code: p.platform_code ?? null,
            location_type: type,
            parent_station: p.parent_station ?? null,
            zone_id: p.zone_id ?? null,
            is_train: isTrain as 0 | 1,
            metro_a: (metroSet.has('A') ? 1 : 0) as 0 | 1,
            metro_b: (metroSet.has('B') ? 1 : 0) as 0 | 1,
            metro_c: (metroSet.has('C') ? 1 : 0) as 0 | 1,
            metro_lines: metroLines.length > 0 ? metroLines.map(name => ({ name, route_color: getVehicleColor('metro', name) })) : undefined,
            metro_color: metroLines.length > 0 ? getVehicleColor('metro', metroLines[0]) : undefined,
            metro_color_2: metroLines.length > 1 ? getVehicleColor('metro', metroLines[1]) : undefined,
            lines: lines.map(l => ({ name: l.name, type: l.type, route_color: getVehicleColor(String(l.type), l.name) }))
        };

        const nodeIdMatch = stopId.match(/^([A-Za-z]*\d+)/);
        const nodeId = nodeIdMatch ? nodeIdMatch[1] : stopId;
        const enrichedFeature: AppStopFeature = { type: 'Feature', geometry: f.geometry, properties: enrichedProperties };

        // Group non-station stops with same name/node into a centroid cluster
        if ((type === 0 || type === 1 || isNaN(type)) && p.stop_name) {
            const centroidKey = `${stopName}_${nodeId}`;
            let ng = nameGroups.get(centroidKey);
            if (!ng) {
                ng = [];
                nameGroups.set(centroidKey, ng);
            }
            ng.push(enrichedFeature);
        }

        // Structural Station (Type 1): Merge all child lines/colors into the parent node
        if (type === 1) {
            const childrenList = ctx.stationChildren.get(stopId) || [];
            const childFeatures = ctx.stationChildrenFeatures.get(stopId) || [];
            
            const uniqueLinesMap = new Map<string, { name: string, type: string | number, route_color: string }>();
            let aggIsTrain = 0;
            const aggMetroSet = new Set<string>();

            for (const cf of childFeatures) {
                for (const l of (cf.properties.lines ?? [])) {
                    const key = `${l.name}_${l.type}`;
                    if (!uniqueLinesMap.has(key)) {
                        uniqueLinesMap.set(key, { name: l.name, type: l.type, route_color: getVehicleColor(String(l.type), l.name) });
                    }
                    const t = String(l.type);
                    if (t === 'metro') {
                        aggMetroSet.add(l.name);
                    } else if (t === 'train' || t === 'rail') {
                        aggIsTrain = 1;
                    }
                }
            }
            
            const aggregatedMetroLines = Array.from(aggMetroSet).sort();

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
                    lines: Array.from(uniqueLinesMap.values()),
                    metro_lines: aggregatedMetroLines.map(name => ({ name, route_color: getVehicleColor('metro', name) })),
                    metro_color: aggregatedMetroLines.length > 0 ? getVehicleColor('metro', aggregatedMetroLines[0]) : undefined,
                    metro_color_2: aggregatedMetroLines.length > 1 ? getVehicleColor('metro', aggregatedMetroLines[1]) : undefined,
                    metro_a: (aggMetroSet.has('A') ? 1 : 0) as 0 | 1,
                    metro_b: (aggMetroSet.has('B') ? 1 : 0) as 0 | 1,
                    metro_c: (aggMetroSet.has('C') ? 1 : 0) as 0 | 1,
                    is_train: (aggIsTrain || isTrain) as 0 | 1,
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
            if (p.parent_station && ctx.stationAnchors.has(p.parent_station)) continue;
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

    return { groups, nameGroups };
}

function generateVirtualCentroids(ctx: EnrichmentContext): AppStopFeature[] {
    const features: AppStopFeature[] = [];

    for (const f of ctx.groups.values()) {
        const allIds = f.properties.all_ids;
        const finalId = allIds && allIds.length > 0 ? allIds.join(',') : f.properties.stop_id;
        features.push({ ...f, properties: { ...f.properties, stop_id: finalId } });
    }

    for (const groupFeatures of ctx.nameGroups.values()) {
        const station = groupFeatures.find(f => Number(f.properties.location_type) === 1);
        const baseFeature = station || groupFeatures[0];
        let sumLng = 0, sumLat = 0;
        let aggIsTrain = 0;
        const aggMetroSet = new Set<string>();
        
        for (const f of groupFeatures) { 
            sumLng += f.geometry.coordinates[0]; 
            sumLat += f.geometry.coordinates[1];
            if (f.properties.is_train === 1) aggIsTrain = 1;
            for (const m of (f.properties.metro_lines || [])) {
                aggMetroSet.add(m.name);
            }
        }
        
        const allMetroNames = Array.from(aggMetroSet).sort();
        const centroidId = `centroid-${baseFeature.properties.stop_id}`;

        features.push({
            type: "Feature", id: centroidId,
            geometry: { type: "Point", coordinates: [sumLng / groupFeatures.length, sumLat / groupFeatures.length] },
            properties: {
                ...baseFeature.properties,
                metro_lines: allMetroNames.map(name => ({ name, route_color: getVehicleColor('metro', name) })),
                metro_a: (aggMetroSet.has('A') ? 1 : 0) as 0 | 1,
                metro_b: (aggMetroSet.has('B') ? 1 : 0) as 0 | 1,
                metro_c: (aggMetroSet.has('C') ? 1 : 0) as 0 | 1,
                is_train: aggIsTrain as 0 | 1,
                is_centroid: true,
                stop_id: centroidId
            }
        });
    }

    return features;
}

/**
 * Processes and groups raw GTFS stop features into structural parent stations and logical centroids.
 * 
 * GTFS Location Types:
 * - 0: Stop/Platform
 * - 1: Station
 * - 2: Entrance/Exit
 *
 * Algorithm:
 * 1. Two-phase structural grouping (identifying Type 1 parents and Type 2 entrances).
 * 2. Logical enrichment (computing aggregated lines, colors, train presence).
 * 3. Centroid generation (creating virtual `is_centroid` nodes for UI map labels).
 *
 * @param allStops Raw GTFS stop features
 * @returns Grouped, enriched, and centroid-injected features
 */
export function processStops(allStops: AppStopFeature[]): AppStopFeature[] {
    const hierarchyCtx = buildStructuralHierarchy(allStops);
    const enrichmentCtx = enrichPublicStops(hierarchyCtx);
    return generateVirtualCentroids(enrichmentCtx);
}
