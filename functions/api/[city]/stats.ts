import { Env } from "../../_core/types";
import { CACHE_TTL, withCityRoute } from "../../_core/api-utils";

export const onRequest: PagesFunction<Env> = withCityRoute(
    (adapter, context) => adapter.handleStats(context),
    CACHE_TTL.VEHICLES // Cache stats for same duration as vehicles
);
