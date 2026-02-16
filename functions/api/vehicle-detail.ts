import { Env } from "../_utils/types";
import { CACHE_TTL, GOLEMIO_BASE_URL, createErrorResponse, createSuccessResponse } from "../_utils/api-utils";

export const onRequest: PagesFunction<Env> = async (context: any) => {
    const { env } = context;
    const { searchParams } = new URL(context.request.url);
    const vehicleId = searchParams.get("vehicleId");
    const tripId = searchParams.get("tripId");

    if (!vehicleId || !tripId) {
        return createErrorResponse("Missing parameters", 400);
    }

    const isPlaceholder = vehicleId.startsWith('trip-');

    const golemioUrl = isPlaceholder
        ? `${GOLEMIO_BASE_URL}/v2/public/gtfs/trips/${tripId}?scopes=info&scopes=stop_times&scopes=shapes&scopes=vehicle_descriptor`
        : `${GOLEMIO_BASE_URL}/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}?scopes=info&scopes=stop_times&scopes=shapes&scopes=vehicle_descriptor`;

    try {
        const response = await fetch(golemioUrl, {
            headers: {
                "X-Access-Token": env.GOLEMIO_API_KEY,
                "Content-Type": "application/json",
            },
            cf: {
                cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
                cacheEverything: true,
            }
        } as any);

        if (!response.ok) {
            return createErrorResponse(`Golemio API Error: ${response.status}`, response.status);
        }

        const data: any = await response.json();

        let vehicleData = data;
        if (isPlaceholder && data.features && Array.isArray(data.features) && data.features.length > 0) {
            vehicleData = data.features[0].properties || data.features[0];
            if (data.shapes) {
                vehicleData.shapes = data.shapes;
            }
        }

        // Shape optimization
        if (vehicleData.shapes && vehicleData.shapes.features) {
            vehicleData.shapes = vehicleData.shapes.features
                .filter((f: any) => f.geometry.type === 'Point')
                .map((f: any) => f.geometry.coordinates);
        } else if (!vehicleData.shapes) {
            vehicleData.shapes = [];
        }

        return createSuccessResponse(vehicleData, CACHE_TTL.VEHICLE_DETAIL);
    } catch {
        return createErrorResponse("Internal Server Error");
    }
};
