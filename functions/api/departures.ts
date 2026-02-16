import { Env } from "../_utils/types";
import { GOLEMIO_BASE_URL, createErrorResponse, createSuccessResponse } from "../_utils/api-utils";
import { filterStopIdsForDepartures, normalizeDeparture } from "../_utils/transit-utils";

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;
    const { searchParams } = new URL(context.request.url);
    const stopId = searchParams.get("stopId");

    if (!stopId) return createErrorResponse("Missing stopId", 400);

    try {
        const idsToFetch = filterStopIdsForDepartures(stopId);
        const stopIdsParam = JSON.stringify({ "0": idsToFetch });

        // Note: Manual construction of URL for complex Golemio nested search params
        const finalUrl = `${GOLEMIO_BASE_URL}/v2/public/departureboards?stopIds[]=${encodeURIComponent(stopIdsParam)}&limit=16&minutesAfter=60`;

        const response = await fetch(finalUrl, {
            headers: {
                "X-Access-Token": env.GOLEMIO_API_KEY,
                "Content-Type": "application/json",
            },
            cf: { cacheTtl: 10, cacheEverything: true }
        } as any);

        if (!response.ok) {
            return createErrorResponse(`Golemio API Error: ${response.status}`, response.status);
        }

        const data = await response.json();
        const allGroups = Array.isArray(data) ? data : [];
        const flattened = allGroups.flat();

        const departures = flattened.map(normalizeDeparture);

        // Sort by time
        departures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return createSuccessResponse({ departures });
    } catch {
        return createErrorResponse("Internal Server Error");
    }
};
