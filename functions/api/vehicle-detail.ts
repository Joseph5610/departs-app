import { Env } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch } from "../_utils/api-utils";

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;
    const { searchParams } = new URL(context.request.url);
    const vehicleId = searchParams.get("vehicleId");
    const tripId = searchParams.get("tripId");

    if (!vehicleId || !tripId) {
        return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
    }

    const isPlaceholder = vehicleId.startsWith('trip-');
    const path = isPlaceholder
        ? `/v2/public/gtfs/trips/${tripId}`
        : `/v2/public/vehiclepositions/${vehicleId};gtfsTripId=${tripId}`;

    try {
        const response = await golemioFetch(path, env, {
            cacheTtl: CACHE_TTL.VEHICLE_DETAIL,
            searchParams: {
                scopes: ['info', 'stop_times', 'shapes', 'vehicle_descriptor']
            }
        });

        if (!response.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
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
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
