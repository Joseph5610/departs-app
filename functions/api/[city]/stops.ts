import { Env } from "../../_core/types";
import { withCityJsonBodyRoute } from "../../_core/api-utils";
import { CACHE_TTL } from "../../_core/config";

export const onRequest: PagesFunction<Env> = withCityJsonBodyRoute(
    (adapter, context) => adapter.handleStopsBody(context),
    CACHE_TTL.STOPS
);
