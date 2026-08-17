import type { AppCitiesResponse } from "../_core/types";
import { CITY_REGISTRY } from "../_core/city-config";
import { CACHE_TTL, createSuccessResponse } from "../_core/api-utils";

export async function onRequest() {
    const response: AppCitiesResponse = { 
        cities: Object.values(CITY_REGISTRY).map(city => ({
            slug: city.slug,
            name: city.name,
            center: city.center,
            bounds: city.bounds,
            isBeta: city.isBeta,
            hasPointsOfSale: city.hasPointsOfSale,
            virtualTableUrl: city.virtualTableUrl,
            filters: city.filters,
        }))
    };
    return createSuccessResponse(response, CACHE_TTL.CITIES);
};
