import { Env } from "../../_core/types";
import { CACHE_TTL, withCityRoute } from "../../_core/api-utils";

export const onRequest: PagesFunction<Env> = withCityRoute(
    (adapter, context) => adapter.handleVehicleDetail(context),
    CACHE_TTL.VEHICLE_DETAIL
);
