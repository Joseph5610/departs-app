import { getVehicleColor } from "./vehicle-colors";
import STOPS_ENRICHMENT from "../_data/stops-enrichment.json";

interface EnrichmentData {
    l: Array<{ n: string; t: string; e: number }>;
    n: string;
}

interface EnrichedLine {
    name: string;
    route_color: string;
}

const enrichmentMap = STOPS_ENRICHMENT as Record<string, EnrichmentData>;
const headsignLookup = new Map<string, EnrichedLine[]>();
const stopIdToMetroLines = new Map<string, EnrichedLine[]>();

// Cache metro line definitions to avoid redundant lookups and object creation
const METRO_DEFS: Record<string, EnrichedLine> = {
    'A': { name: 'A', route_color: getVehicleColor('metro', 'A') },
    'B': { name: 'B', route_color: getVehicleColor('metro', 'B') },
    'C': { name: 'C', route_color: getVehicleColor('metro', 'C') },
};

// Temporary maps for aggregation
const nameToLines = new Map<string, Set<EnrichedLine>>();
const parentToLines = new Map<string, Set<EnrichedLine>>();

// First pass: Aggregate all metro lines by name and parent ID
for (const [stopId, data] of Object.entries(enrichmentMap)) {
    const metroLines = data.l.filter(line => line.t === 'metro' || line.t === '1');
    if (metroLines.length === 0) continue;

    const name = data.n.trim().toUpperCase();
    const parentId = stopId.split('Z')[0];

    if (!nameToLines.has(name)) nameToLines.set(name, new Set());
    if (!parentToLines.has(parentId)) parentToLines.set(parentId, new Set());

    const nameSet = nameToLines.get(name)!;
    const parentSet = parentToLines.get(parentId)!;

    for (const line of metroLines) {
        const enriched = METRO_DEFS[line.n.toUpperCase()];
        if (enriched) {
            nameSet.add(enriched);
            parentSet.add(enriched);
        }
    }
}

// Second pass: Populate final lookups with aggregated and sorted data
// We use a cache to avoid re-sorting the same lists for multiple platforms of the same station
const aggregatedListCache = new Map<string, EnrichedLine[]>();

for (const [stopId, data] of Object.entries(enrichmentMap)) {
    const name = data.n.trim().toUpperCase();
    const parentId = stopId.split('Z')[0];

    const cacheKey = `${name}|${parentId}`;
    let uniqueLines = aggregatedListCache.get(cacheKey);

    if (uniqueLines === undefined) {
        const nameSet = nameToLines.get(name);
        const parentSet = parentToLines.get(parentId);

        if (!nameSet && !parentSet) {
            uniqueLines = [];
        } else {
            const combined = new Set<EnrichedLine>();
            nameSet?.forEach(l => combined.add(l));
            parentSet?.forEach(l => combined.add(l));
            uniqueLines = Array.from(combined).sort((a, b) => a.name.localeCompare(b.name));
        }
        aggregatedListCache.set(cacheKey, uniqueLines);
    }

    if (uniqueLines.length > 0) {
        stopIdToMetroLines.set(stopId, uniqueLines);
        // Only set headsignLookup once per unique name
        if (!headsignLookup.has(name)) {
            headsignLookup.set(name, uniqueLines);
        }
    }
}

/**
 * Gets enriched line metadata for a specific stop ID.
 */
export function getStopEnrichment(stopId: string): EnrichmentData | undefined {
    return enrichmentMap[stopId];
}

/**
 * Gets enriched metro lines for a specific stop ID.
 */
export function getMetroLinesForStop(stopId: string): EnrichedLine[] {
    return stopIdToMetroLines.get(stopId) || [];
}

/**
 * Checks if a headsign matches a known metro station and returns its enriched lines.
 */
export function getMetroLinesForHeadsign(headsign: string): EnrichedLine[] {
    return headsignLookup.get(headsign.trim().toUpperCase()) || [];
}

