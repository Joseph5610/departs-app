import { Env } from "../../_core/types";
import { withCityJsonBodyRoute } from "../../_cities/route";
import { CACHE_TTL } from "../../_core/config";
import { MapStopsService } from "../../_feeds/stops";

export const onRequest: PagesFunction<Env> = withCityJsonBodyRoute(
    (city) => new MapStopsService(city).getStopsBody(),
    CACHE_TTL.STOPS
);
