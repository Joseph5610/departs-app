import { Env } from "../_utils/types";
import { CACHE_TTL, TRANSIT_CONFIG, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch } from "../_utils/api-utils";
import { filterStopIdsForDepartures, normalizeDeparture } from "../_utils/transit-utils";
import { getVehicleColor } from "../_utils/vehicle-colors";

/**
 * Retrieves the departure board for a given stop ID or multiple stop IDs.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;
    const { searchParams } = new URL(context.request.url);
    const stopId = searchParams.get("stopId");

    if (!stopId) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    try {
        // 1. Filter stop IDs to ensure compatibility with Golemio's departure board endpoint
        const idsToFetch = filterStopIdsForDepartures(stopId);

        // Golemio expects stopIds as a stringified object in a specific format for some reason
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

        // 2. Flatten and normalize departures
        // The API might return an array of arrays if multiple groups were requested
        const allGroups = Array.isArray(data) ? data : [];
        const flattened = allGroups.flat();

        const departures = flattened.map((item: any) => {
            const normalized = normalizeDeparture(item);
            return {
                ...normalized,
                line_color: getVehicleColor(normalized.type, normalized.line)
            };
        });

        // 3. Sort by predicted time (falling back to scheduled time)
        departures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return createSuccessResponse({ departures }, CACHE_TTL.DEPARTURES);
    } catch (error) {
        console.error("Departures API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
