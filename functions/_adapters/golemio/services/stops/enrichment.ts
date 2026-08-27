import { getVehicleColor } from "../vehicles/colors";
import { GOLEMIO_CONFIG } from "../../core/config";
import { CacheManager, CACHE_TTL } from "../../../../_core/utils/CacheManager";

export interface EnrichmentData {
    l: Array<{ n: string; t: string; e: number }>;
    n: string;
}

export interface EnrichedLine {
    name: string;
    route_color: string;
}

export interface ProcessedEnrichmentData {
    enrichmentMap: Record<string, EnrichmentData>;
    headsignLookup: Map<string, EnrichedLine[]>;
    stopIdToMetroLines: Map<string, EnrichedLine[]>;
}

// Cache metro line definitions to avoid redundant lookups and object creation
const METRO_DEFS: Record<string, EnrichedLine> = {
    'A': { name: 'A', route_color: getVehicleColor('metro', 'A') },
    'B': { name: 'B', route_color: getVehicleColor('metro', 'B') },
    'C': { name: 'C', route_color: getVehicleColor('metro', 'C') },
};

/**
 * Fetches and caches the enrichment data from the external CDN.
 * Uses CacheManager to prevent concurrent fetch stampedes and keep data in memory.
 */
export async function getEnrichmentData(): Promise<ProcessedEnrichmentData> {
    return CacheManager.getOrFetch('prague_enrichment', CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const res = await fetch(GOLEMIO_CONFIG.ENRICHMENT_DATA_URL, {
                cf: { cacheTtl: 86400 } // Cache at Cloudflare edge for 24h
            } as RequestInit);
            
            if (!res.ok) {
                console.error("Failed to fetch Prague enrichment data:", res.status);
                return {
                    enrichmentMap: {},
                    headsignLookup: new Map(),
                    stopIdToMetroLines: new Map()
                };
            }
            
            const enrichmentMap = await res.json() as Record<string, EnrichmentData>;
            const headsignLookup = new Map<string, EnrichedLine[]>();
            const stopIdToMetroLines = new Map<string, EnrichedLine[]>();

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

            return { enrichmentMap, headsignLookup, stopIdToMetroLines };
        } catch (error) {
            console.error("Error fetching or processing enrichment data:", error);
            return {
                enrichmentMap: {},
                headsignLookup: new Map(),
                stopIdToMetroLines: new Map()
            };
        }
    });
}
