import { Env } from "../_utils/types";
import { golemioFetch, createErrorResponse, createSuccessResponse } from "../_utils/api-utils";
import { processStops } from "../_utils/transit-utils";

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    const fetchAllStops = async () => {
        let allFeatures: any[] = [];
        let offset = 0;
        const limit = 10000;

        while (offset < 40000) {
            const res = await golemioFetch("/v2/gtfs/stops", env, {
                cacheTtl: 3600,
                searchParams: {
                    limit: limit.toString(),
                    offset: offset.toString()
                }
            });

            if (!res.ok) break;
            const data = await res.json() as { features: any[] };
            if (!data.features || data.features.length === 0) break;

            allFeatures = [...allFeatures, ...data.features];
            if (data.features.length < limit) break;
            offset += limit;
        }
        return allFeatures;
    };

    try {
        const all = await fetchAllStops();
        if (all.length === 0) return createErrorResponse("Golemio error or no data", 502);

        const features = processStops(all);

        return createSuccessResponse({ type: "FeatureCollection", features }, 86400);
    } catch (err) {
        return createErrorResponse("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
};
