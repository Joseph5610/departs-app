import { GOLEMIO_API, CACHE_CONFIG } from '../_utils/config';

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
    const isPlaceholder = vehicleId.startsWith('trip-');
    const scopes = 'scopes=info&scopes=stop_times&scopes=shapes&scopes=vehicle_descriptor';

    // Standard endpoints are much better for detailed info
    const golemioUrl = isPlaceholder
        ? `${GOLEMIO_API.BASE_URL}${GOLEMIO_API.ENDPOINTS.TRIPS}/${tripId}?${scopes}`
        : `${GOLEMIO_API.BASE_URL}${GOLEMIO_API.ENDPOINTS.VEHICLE_POSITIONS}/${vehicleId};gtfsTripId=${tripId}?${scopes}`;

    try {
        const response = await fetch(golemioUrl, {
            headers: {
                "X-Access-Token": env.GOLEMIO_API_KEY,
                "Content-Type": "application/json",
            },
            cf: {
                cacheTtl: CACHE_CONFIG.DEFAULT_TTL,
                cacheEverything: true,
            }
        } as any);

        if (!response.ok) {
            return new Response(`Golemio API Error: ${response.status}`, { status: response.status });
        }

        const data: any = await response.json();

        let vehicleData = data;
        if (isPlaceholder && data.features && Array.isArray(data.features) && data.features.length > 0) {
            vehicleData = data.features[0].properties || data.features[0];
            if (data.shapes) {
                vehicleData.shapes = data.shapes;
            }
        }

        // Optimize shapes payload
        if (vehicleData.shapes && vehicleData.shapes.features) {
            vehicleData.shapes = vehicleData.shapes.features
                .filter((f: any) => f.geometry.type === 'Point')
                .map((f: any) => f.geometry.coordinates);
        } else if (!vehicleData.shapes) {
            vehicleData.shapes = [];
        }

        return new Response(JSON.stringify(vehicleData), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": `public, max-age=${CACHE_CONFIG.DEFAULT_TTL}`,
            },
        });
    } catch (err) {
        return new Response("Internal Server Error", { status: 500 });
    }
};
