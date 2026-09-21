import { Env } from "../../../_core/types";
import { withCityRoute } from "../../../_cities/route";

export const onRequest: PagesFunction<Env> = withCityRoute(
    (city, context) => {
        const type = context.url.searchParams.get('type') || 'vehicles';
        return city.debugFeed.getRawFeed(context, type);
    },
    10 // small TTL to not overload upstream but allow caching
);
