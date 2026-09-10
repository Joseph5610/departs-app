import { Env } from "../../_core/types";
import { withCityRoute } from "../../_core/api-utils";
import { CACHE_TTL } from "../../_core/config";

export const onRequest: PagesFunction<Env> = withCityRoute(
    (adapter, context) => adapter.handleVehicles(context),
    CACHE_TTL.VEHICLES
);
