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
        // Also filter out 'N' IDs (Internal nodes?) and 'E' (Entrances) which cause bloat and 400 errors.
        // We generally only want IDs containing 'Z' (Zastávka/Stop) which are the actual boarding platforms.
        const finalIds = rawIds.filter(id => {
            if (id.includes('S')) return false; // Stations/Entrances
            // Check for 'Z' as indicator of a Stop identifier.
            // PID IDs usually look like U123Z1 or U123Z1P. 
            // The problematic ones are U1072N1, U1072N2 etc.
            if (!id.includes('Z')) return false;
            return true;
        });
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
            isCanceled: item.trip.is_canceled,
            tripId: item.trip.id
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
