import { Env } from "../../_core/types";
import { withCityRoute } from "../../_cities/route";
import { CACHE_TTL } from "../../_core/config";

export const onRequest: PagesFunction<Env> = withCityRoute(
    (city, context) => city.alerts.getAlerts(context),
    CACHE_TTL.RSS_INCIDENTS
);
