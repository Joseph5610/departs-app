import type { AppCitiesResponse } from "../_core/types";
import { CITY_REGISTRY } from "../_core/city-config";
import { createSuccessResponse } from "../_core/api-utils";

export async function onRequest() {
    const response: AppCitiesResponse = { 
        cities: Object.values(CITY_REGISTRY).map(city => ({
            slug: city.slug,
            name: city.name,
            center: city.center,
            bounds: city.bounds,
            isBeta: city.isBeta,
            virtualTableUrl: city.virtualTableUrl,
            filters: city.filters,
        }))
    };
    return createSuccessResponse(response, 3600); // cache for 1 hour
};
