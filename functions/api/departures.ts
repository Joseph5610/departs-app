import { Env } from "../_utils/types";
import { CACHE_TTL, TRANSIT_CONFIG, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch } from "../_utils/api-utils";
import { filterStopIdsForDepartures, normalizeDeparture } from "../_utils/transit-utils";

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;
    const { searchParams } = new URL(context.request.url);
    const stopId = searchParams.get("stopId");

    if (!stopId) return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);

    try {
        const idsToFetch = filterStopIdsForDepartures(stopId);
        const stopIdsParam = JSON.stringify({ "0": idsToFetch });

        const response = await golemioFetch("/v2/public/departureboards", env, {
            cacheTtl: CACHE_TTL.DEPARTURES,
            searchParams: {
                "stopIds[]": stopIdsParam,
                limit: TRANSIT_CONFIG.DEPARTURE_LIMIT.toString(),
                minutesAfter: TRANSIT_CONFIG.DEPARTURE_MINUTES_AFTER.toString()
            }
        });

        if (!response.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data = await response.json();
        const allGroups = Array.isArray(data) ? data : [];
        const flattened = allGroups.flat();

        const departures = flattened.map(normalizeDeparture);

        // Sort by time
        departures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return createSuccessResponse({ departures }, CACHE_TTL.DEPARTURES);
    } catch {
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
