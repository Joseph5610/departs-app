import { Env, GolemioDepartureItem, AppDeparture } from "../_utils/types";
import { CACHE_TTL, TRANSIT_CONFIG, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch, sanitizeId, fixCommaSpacing } from "../_utils/api-utils";
import { getVehicleColor } from "../_utils/vehicle-colors";
import { getMetroLinesForHeadsign } from "../_utils/enrichment";

function normalizeDeparture(item: GolemioDepartureItem): AppDeparture {
    const line = String(item.route?.short_name || '?').toUpperCase();
    const type = String(item.route?.type || (['A', 'B', 'C'].includes(line) ? '1' : '0'));
    const isMetro = type === '1' || ['A', 'B', 'C'].includes(line);

    let directionId: string | number | null | undefined = item.trip?.direction_id;

    // For Metro, we use stop ID (platform) as directionId to group by platform
    if (isMetro && item.stop?.id) {
        directionId = item.stop.id;
    }

    if (directionId === undefined || directionId === null) {
        directionId = item.trip?.direction_id ?? item.stop?.platform_code ?? item.trip?.headsign ?? '0';
    }

    const headsign = fixCommaSpacing(item.trip?.headsign) || 'Unknown';

    return {
        timestamp: item.departure.timestamp_predicted || item.departure.timestamp_scheduled,
        scheduled: item.departure.timestamp_scheduled,
        delay: item.departure.delay_seconds || 0,
        line,
        type,
        directionId: String(directionId),
        headsign,
        isCanceled: item.trip?.is_canceled || false,
        tripId: item.trip?.id,
        vehicleId: item.vehicle?.id,
        platform: item.stop?.platform_code || undefined,
        route_color: getVehicleColor(type, line),
        headsign_metro_lines: getMetroLinesForHeadsign(headsign).filter(l => l.name !== line)
    };
}

/**
 * Filters stop IDs for departures to avoid 400 errors from Golemio.
 * Removes parent stations (contain 'S') and keeps platforms (contain 'Z').
 */
export function filterStopIdsForDepartures(stopId: string): string[] {
    const rawIds = stopId.split(',');
    const finalIds = rawIds.filter(id => {
        if (id.includes('S')) return false; // Filter out stations (parent stations)
        if (!id.includes('Z')) return false; // Keep only platform-level stops
        return true;
    });
    return finalIds.length > 0 ? finalIds : rawIds;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;
    const { searchParams } = new URL(context.request.url);
    const stopId = sanitizeId(searchParams.get("stopId"));

    if (!stopId) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

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

        const data = await response.json() as GolemioDepartureItem[][];
        const flattened = Array.isArray(data) ? data.flat() : [];
        const departures = flattened.map(normalizeDeparture);

        // Sort by predicted time (falling back to scheduled time)
        departures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return createSuccessResponse({ departures }, CACHE_TTL.DEPARTURES);
    } catch (error) {
        console.error("Departures API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
