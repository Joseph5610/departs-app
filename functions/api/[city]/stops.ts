import { Env } from "../../_core/types";
import { withCityJsonBodyRoute } from "../../_core/api-utils";
import { CACHE_TTL } from "../../_core/config";
import { MapStopsService } from "../../_core/MapStopsService";

export const onRequest: PagesFunction<Env> = withCityJsonBodyRoute(
    (city) => new MapStopsService(city).getStopsBody(),
    CACHE_TTL.STOPS
);
