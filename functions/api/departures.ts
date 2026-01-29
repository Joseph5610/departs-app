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
        // Filter out station IDs (Type 1), only platforms work in departures.
        // Station IDs usually have 'S' (e.g., U123S1).
        const finalIds = rawIds.filter(id => !id.includes('S'));
        const idsToFetch = finalIds.length > 0 ? finalIds : rawIds;

        // Using the most stable Golemio endpoint
        const golemioUrl = new URL("https://api.golemio.cz/v2/public/departureboards");

        // DOCUMENTATION FORMAT: stopIds[]={"0": ["ID1", "ID2"]}
        // We put all IDs into a single group "0" to get a combined result.
        const stopIdsParam = JSON.stringify({ "0": idsToFetch });
        golemioUrl.searchParams.append("stopIds", stopIdsParam); // Note: some versions don't need [] in searchParams.append if already in key

        // Limit data to prevent excessive requests, 12 items / 60 mins is plenty for grouped view
        const finalUrl = `${golemioUrl.origin}${golemioUrl.pathname}?stopIds[]=${encodeURIComponent(stopIdsParam)}&limit=12&minutesAfter=60`;

        const response = await fetch(finalUrl, {
            headers: {
                "X-Access-Token": env.GOLEMIO_API_KEY,
                "Content-Type": "application/json",
            },
            cf: { cacheTtl: 10, cacheEverything: true }
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

        const departures = flattened.map((item: any) => ({
            timestamp: item.departure.timestamp_predicted || item.departure.timestamp_scheduled,
            scheduled: item.departure.timestamp_scheduled,
            delay: item.departure.delay_seconds || 0,
            line: item.route.short_name,
            type: item.route.type,
            headsign: item.trip.headsign,
            isCanceled: item.trip.is_canceled
        }));

        // Sort by time
        departures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return new Response(JSON.stringify({ departures }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=10",
            },
        });
    } catch (err) {
        return new Response("Internal Server Error", { status: 500 });
    }
};
