import { Env } from "../../_core/types";
import { withCityResponseRoute } from "../../_cities/route";
import { CACHE_TTL } from "../../_core/config";
import { createJsonBodyResponse, createSuccessResponse } from "../../_core/api-utils";

// An offline answer must not be held by the edge: every client polls this one URL per city.
const ttl = (offline: boolean) => (offline ? 0 : CACHE_TTL.VEHICLES);

export const onRequest: PagesFunction<Env> = withCityResponseRoute(async (city, context) => {
    const serialized = await city.vehicles.getVehiclesBody?.(context);
    if (serialized) return createJsonBodyResponse(serialized.body, ttl(serialized.offline));

    const vehicles = await city.vehicles.getVehicles(context);
    return createSuccessResponse(vehicles, ttl(vehicles.status === 'upstream_offline'));
});
