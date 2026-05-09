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

// Pre-calculate lookups for O(1) access
for (const [stopId, data] of Object.entries(enrichmentMap)) {
    const linesMap = new Map<string, EnrichedLine>();
    data.l
        .filter(line => line.t === 'metro' || line.t === '1')
        .forEach(line => {
            if (!linesMap.has(line.n)) {
                linesMap.set(line.n, {
                    name: line.n,
                    route_color: getVehicleColor('metro', line.n)
                });
            }
        });
    
    const uniqueLines = Array.from(linesMap.values());
    if (uniqueLines.length > 0) {
        headsignLookup.set(data.n.toUpperCase(), uniqueLines);
        stopIdToMetroLines.set(stopId, uniqueLines);
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

