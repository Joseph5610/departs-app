import { Env } from "../../../_core/types";
import { withCityRoute } from "../../../_core/api-utils";

export const onRequest: PagesFunction<Env> = withCityRoute(
    (adapter, context) => {
        const url = new URL(context.request.url);
        const type = url.searchParams.get('type') || 'vehicles';
        return adapter.handleRawFeed(context, type);
    },
    10 // small TTL to not overload upstream but allow caching
);
