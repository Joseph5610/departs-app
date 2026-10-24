import { Env } from "../../_core/types";
import { withCityRoute } from "../../_cities/route";
import { CACHE_TTL } from "../../_core/config";
import { departuresQuerySchema, parseSearchParams } from "../../_core/schemas";
import { capPerLine } from "../../_domain/departures/perLine";

export const onRequest: PagesFunction<Env> = withCityRoute(
    async (city, context) => {
        const { perLine } = parseSearchParams(context.url.searchParams, departuresQuerySchema);
        const response = await city.departures.getDepartures(context);
        return perLine ? capPerLine(response, perLine) : response;
    },
    CACHE_TTL.DEPARTURES
);
