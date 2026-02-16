import { Env } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, golemioFetch, createErrorResponse, createSuccessResponse } from "../_utils/api-utils";
import { normalizeVehicleFeature, processVehicleFeatures } from "../_utils/transit-utils";

export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const bounds = url.searchParams.get("bounds");
    const routeType = url.searchParams.get("routeType");
    const tripId = url.searchParams.get("tripId");
    const routeShortNames = url.searchParams.getAll("routeShortName");

    try {
        let allFeatures: any[] = [];

        if (tripId && bounds) {
            // COMBINED: Fetch both and merge
            const boundsParams: Record<string, string | string[]> = {
                boundingBox: bounds
            };
            if (routeType) boundsParams.routeType = routeType;
            if (routeShortNames.length > 0) boundsParams.routeShortName = routeShortNames;

            const [tripRes, boundsRes] = await Promise.all([
                golemioFetch(`/v2/vehiclepositions/${tripId}`, env),
                golemioFetch("/v2/public/vehiclepositions", env, { searchParams: boundsParams })
            ]);

            const tripData: any = tripRes.ok ? await tripRes.json() : null;
            const boundsData: any = boundsRes.ok ? await boundsRes.json() : { features: [] };

            const rawBoundsFeatures = boundsData.features || [];
            const normalizedBoundsFeatures = rawBoundsFeatures.map((f: any) => normalizeVehicleFeature(f));

            if (tripData) {
                const tripFeatures = tripData.type === 'FeatureCollection'
                    ? (tripData.features || [])
                    : (tripData.type === 'Feature' ? [tripData] : []);

                const normalizedTripFeatures = tripFeatures.map((f: any) => normalizeVehicleFeature(f, tripId));
                allFeatures = [...normalizedBoundsFeatures, ...normalizedTripFeatures];
            } else {
                allFeatures = normalizedBoundsFeatures;
            }
        } else if (tripId || bounds || routeShortNames.length > 0) {
            // SINGLE MODE
            if (tripId) {
                const response = await golemioFetch(`/v2/vehiclepositions/${tripId}`, env);
                if (!response.ok) return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);

                const data: any = await response.json();
                const feature = (data.type === 'FeatureCollection' && data.features?.length > 0)
                    ? data.features[0]
                    : (data.type === 'Feature' ? data : null);

                if (feature) {
                    allFeatures = [normalizeVehicleFeature(feature, tripId)];
                }
            } else {
                const params: Record<string, string | string[]> = {};
                if (bounds) params.boundingBox = bounds;
                if (routeType) params.routeType = routeType;
                if (routeShortNames.length > 0) params.routeShortName = routeShortNames;

                const response = await golemioFetch("/v2/public/vehiclepositions", env, { searchParams: params });
                if (!response.ok) return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);

                const data: any = await response.json();
                const rawFeatures = data.features || [];
                allFeatures = rawFeatures.map((f: any) => normalizeVehicleFeature(f));
            }
        } else {
            return createErrorResponse(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

        const features = processVehicleFeatures(allFeatures);
        return createSuccessResponse({ type: 'FeatureCollection', features }, CACHE_TTL.VEHICLES);

    } catch {
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
