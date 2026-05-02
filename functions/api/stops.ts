import { Env, PidStopsResponse, PidLine, GolemioStopFeature } from "../_utils/types";
import { CACHE_TTL, TRANSIT_CONFIG, ERROR_MESSAGES, golemioFetch, createErrorResponse, createSuccessResponse } from "../_utils/api-utils";
import { processStops } from "../_utils/transit-utils";
import stopsEnrichment from "../_data/stops-enrichment.json";


/**
 * Endpoint for retrieving and processing all PID stops from the official source.
 * This source is pre-filtered for active stops and pre-grouped by node.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    /**
     * Fetches all Golemio stops using pagination.
     */
    const fetchAllGolemioStops = async () => {
        let allFeatures: GolemioStopFeature[] = [];
        let offset = 0;
        const limit = TRANSIT_CONFIG.STOPS_FETCH_LIMIT;

        while (offset < TRANSIT_CONFIG.STOPS_MAX_OFFSET) {
            const res = await golemioFetch("/v2/gtfs/stops", env, {
                cacheTtl: CACHE_TTL.GTFS_DATA,
                searchParams: {
                    limit: limit.toString(),
                    offset: offset.toString()
                }
            });

            if (!res.ok) break;

            const data = await res.json() as { features: GolemioStopFeature[] };
            if (!data.features || data.features.length === 0) break;

            allFeatures = [...allFeatures, ...data.features];
            if (data.features.length < limit) break;
            offset += limit;
        }
        return allFeatures;
    };

    try {
        // 1. Access pre-built Enrichment Map
        const enrichmentMap = stopsEnrichment as Record<string, { l: Array<{ n: string, t: string, e: number }>, n: string }>;
        console.log(`Using pre-built enrichment data: ${Object.keys(enrichmentMap).length} entries.`);

        // 2. Fetch Golemio data
        const allRawStops = await fetchAllGolemioStops();

        if (allRawStops.length === 0) {
            return createErrorResponse(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
        }

        // 3. Filter and Enrich
        let enrichedCount = 0;
        const processedStops = allRawStops
            .filter(f => {
                const id = f.properties.stop_id;
                const enrichment = enrichmentMap[id];

                // If the stop is NOT in the PID list, we keep it as-is (Safety/Fallback for things like Flora)
                if (!enrichment) return true;

                // If it IS in the PID list, it must have:
                // 1. At least one line
                // 2. At least one line that is NOT 'exitOnly' (we want departures!)
                const hasActiveDepartures = enrichment.l && enrichment.l.some(l => l.e === 0);

                return hasActiveDepartures;
            })

            .map(f => {
                const enrichment = enrichmentMap[f.properties.stop_id];
                if (enrichment) {
                    enrichedCount++;
                    // Enrich with clean data from PID source
                    f.properties.lines = enrichment.l.map(l => ({ name: l.n, type: l.t, exitOnly: l.e === 1 }));
                    if (enrichment.n) f.properties.stop_name = enrichment.n;
                }
                return f;
            });

        console.log(`Processing complete. Total stops: ${allRawStops.length}, Enriched: ${enrichedCount}, Final: ${processedStops.length}`);

        // 4. Transform and group
        const features = processStops(processedStops);

        return createSuccessResponse({
            type: "FeatureCollection",
            features
        }, CACHE_TTL.STOPS);

    } catch (error) {
        console.error("Stops API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};



