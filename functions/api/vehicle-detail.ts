interface Env {
    GOLEMIO_API_KEY: string;
}

export const onRequest: PagesFunction<Env> = async (context: any) => {
    const { env } = context;
    const { searchParams } = new URL(context.request.url);
    const vehicleId = searchParams.get("vehicleId");
    const tripId = searchParams.get("tripId");

    if (!vehicleId || !tripId) {
        return new Response("Missing parameters", { status: 400 });
    }

    // Golemio matrix parameter syntax with multiple scopes
    const golemioUrl = `https://api.golemio.cz/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}?scopes=info&scopes=stop_times&scopes=shapes&scopes=vehicle_descriptor`;

    try {
        const response = await fetch(golemioUrl, {
            headers: {
                "X-Access-Token": env.GOLEMIO_API_KEY,
                "Content-Type": "application/json",
            },
            cf: {
                cacheTtl: 30,
                cacheEverything: true,
            }
        } as any);

        if (!response.ok) {
            return new Response(`Golemio API Error: ${response.status}`, { status: response.status });
        }

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=30",
            },
        });
    } catch (err) {
        return new Response("Internal Server Error", { status: 500 });
    }
};
