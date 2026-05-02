import { Env, PidStopsResponse, PidLine, GolemioStopFeature } from "../_utils/types";
import { CACHE_TTL, TRANSIT_CONFIG, ERROR_MESSAGES, golemioFetch, createErrorResponse, createSuccessResponse } from "../_utils/api-utils";
import { processStops } from "../_utils/transit-utils";



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
        // 1. Fetch PID Data FIRST and extract only what we need
        let pidData: { enrichmentMap: Map<string, { lines: PidLine[], fullName: string }> } = {
            enrichmentMap: new Map()
        };

        const pidRes = await fetch(TRANSIT_CONFIG.STOPS_SOURCE_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
                "Accept": "application/json",
                "Accept-Language": "cs,en;q=0.9",
                "Referer": "https://departs.app/"
            },
            cf: {
                cacheTtl: CACHE_TTL.STOPS,
                cacheEverything: true,
            }
        });

        console.log(`PID Source Fetch: ${pidRes.status} ${pidRes.statusText}`);

        if (pidRes.ok) {
            let rawPid = await pidRes.json() as PidStopsResponse;
            console.log(`PID Data Received. Groups: ${rawPid.stopGroups?.length || 0}`);

            rawPid.stopGroups?.forEach(g => {
                g.stops?.forEach(s => {
                    s.gtfsIds?.forEach(id => {
                        pidData.enrichmentMap.set(id, {
                            lines: s.lines || [],
                            fullName: g.fullName || g.name
                        });
                    });
                });
            });

            console.log(`Enrichment Map built: ${pidData.enrichmentMap.size} entries.`);

            // CRITICAL: Clear the large raw object from memory
            (rawPid as any) = null;
        } else {
            console.error(`Failed to fetch PID enrichment data: ${pidRes.status} ${pidRes.statusText}`);
        }

        // 2. Fetch Golemio data SECOND
        const allRawStops = await fetchAllGolemioStops();

        if (allRawStops.length === 0) {
            return createErrorResponse(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
        }

        // 3. Filter and Enrich
        let enrichedCount = 0;
        const processedStops = allRawStops
            .filter(f => {
                const id = f.properties.stop_id;
                const enrichment = pidData.enrichmentMap.get(id);

                // If the stop is NOT in the PID list, we keep it as-is (Safety/Fallback for things like Flora)
                if (!enrichment) return true;

                // If it IS in the PID list, it must have:
                // 1. At least one line
                // 2. At least one line that is NOT 'exitOnly' (we want departures!)
                const hasActiveDepartures = enrichment.lines && enrichment.lines.some(l => !l.exitOnly);

                return hasActiveDepartures;
            })

            .map(f => {
                const enrichment = pidData.enrichmentMap.get(f.properties.stop_id);
                if (enrichment) {
                    enrichedCount++;
                    // Enrich with clean data from PID source
                    f.properties.lines = enrichment.lines;
                    if (enrichment.fullName) f.properties.stop_name = enrichment.fullName;
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



