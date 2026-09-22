import { Env } from "../../_core/types";
import { withCityRoute } from "../../_cities/route";
import { CACHE_TTL } from "../../_core/config";

// An offline answer must not be held by the edge: every client polls this one URL per city.
export const onRequest: PagesFunction<Env> = withCityRoute(
    (city, context) => city.vehicles.getVehicles(context),
    (vehicles) => (vehicles.status === 'upstream_offline' ? 0 : CACHE_TTL.VEHICLES)
);
