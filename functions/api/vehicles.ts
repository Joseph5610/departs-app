interface Env {
    GOLEMIO_API_KEY: string;
}

export const onRequest: PagesFunction<Env> = async (context: any) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const bounds = url.searchParams.get("bounds"); // expected format: latMin,longMin,latMax,longMax
    const routeType = url.searchParams.get("routeType");

    if (!bounds) {
        return new Response("Missing 'bounds' parameter. Format: latMin,longMin,latMax,longMax", { status: 400 });
    }

    // Construct Golemio URL
    const golemioUrl = new URL("https://api.golemio.cz/v2/public/vehiclepositions");
    golemioUrl.searchParams.set("boundingBox", bounds);

    if (routeType) {
        golemioUrl.searchParams.set("routeType", routeType);
    }

    try {
        const response = await fetch(golemioUrl.toString(), {
            headers: {
                "X-Access-Token": env.GOLEMIO_API_KEY,
                "Content-Type": "application/json",
            },
            cf: {
                cacheTtl: 10,
                cacheEverything: true,
            }
        } as any);

        if (!response.ok) {
            return new Response(`Golemio API Error: ${response.status} ${response.statusText}`, { status: response.status });
        }

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=10, s-maxage=10", // CDN cache 10s
            },
        });
    } catch (err) {
        return new Response(`Internal Server Error: ${err}`, { status: 500 });
    }
};
