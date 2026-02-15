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
    // If vehicleId is a synthetic placeholder (only starts with "trip-"), we fall back to Static lookup
    // 'service-' IDs are valid live vehicle IDs from Golemio
    const isPlaceholder = vehicleId.startsWith('trip-');

    const scopes = 'scopes=info&scopes=stop_times&scopes=shapes&scopes=vehicle_descriptor';
    const golemioUrl = isPlaceholder
        ? `${GOLEMIO_API.PUBLIC_BASE_URL}/gtfs/trips/${tripId}?${scopes}`
        : `${GOLEMIO_API.PUBLIC_BASE_URL}/vehiclepositions/${vehicleId};gtfsTripId=${tripId}?${scopes}`;

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

        // When querying by gtfsTripId only (placeholder case), the API returns a FeatureCollection
        // We need to extract the first matching vehicle
        let vehicleData = data;
        if (isPlaceholder && data.features && Array.isArray(data.features) && data.features.length > 0) {
            vehicleData = data.features[0].properties || data.features[0];
            // Preserve shapes if they exist at the collection level
            if (data.shapes) {
                vehicleData.shapes = data.shapes;
            }
        }

        // SCALPEL OPTIMIZATION 🔪
        // The Golemio API returns `shapes` as a FeatureCollection with thousands of Point features.
        // This is huge and slow. We extract just the coordinates into a simple array.
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
