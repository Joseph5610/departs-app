import { GOLEMIO_API, CACHE_CONFIG, LIMITS } from '../_utils/config';
import { normalizeDepartureItem, isValidStopId } from '../_utils/transit-utils';

interface Env {
    GOLEMIO_API_KEY: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;
    const { searchParams } = new URL(context.request.url);
    const stopId = searchParams.get("stopId");

    if (!stopId) return new Response("Missing stopId", { status: 400 });

    try {
        const rawIds = stopId.split(',');
        const finalIds = rawIds.filter(isValidStopId);
        const idsToFetch = finalIds.length > 0 ? finalIds : rawIds;

        // Using the most stable Golemio endpoint
        const golemioUrl = new URL(`${GOLEMIO_API.PUBLIC_BASE_URL}/departureboards`);

        // DOCUMENTATION FORMAT: stopIds[]={"0": ["ID1", "ID2"]}
        // We put all IDs into a single group "0" to get a combined result.
        const stopIdsParam = JSON.stringify({ "0": idsToFetch });

        // Limit data to prevent excessive requests, 16 items / 60 mins is plenty for grouped view
        const finalUrl = `${golemioUrl.origin}${golemioUrl.pathname}?stopIds[]=${encodeURIComponent(stopIdsParam)}&limit=${LIMITS.DEPARTURES_LIMIT}&minutesAfter=${LIMITS.DEPARTURES_MINUTES_AFTER}`;

        const response = await fetch(finalUrl, {
            headers: {
                "X-Access-Token": env.GOLEMIO_API_KEY,
                "Content-Type": "application/json",
            },
            cf: { cacheTtl: CACHE_CONFIG.DEFAULT_TTL, cacheEverything: true }
        } as any);

        if (!response.ok) {
            return new Response(`Golemio API Error: ${response.status}`, { status: response.status });
        }

        const data = await response.json();

        // Golemio returns an array of groups: [ group0, group1, ... ]
        // Each group is an array of departure items.
        // We flatten all groups into one list.
        const allGroups = Array.isArray(data) ? data : [];
        const flattened = allGroups.flat();

        const departures = flattened.map(normalizeDepartureItem);

        // Sort by time
        departures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return new Response(JSON.stringify({ departures }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": `public, max-age=${CACHE_CONFIG.DEFAULT_TTL}`,
            },
        });
    } catch (err) {
        return new Response("Internal Server Error", { status: 500 });
    }
};
