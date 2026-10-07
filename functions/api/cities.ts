import type { AppCitiesResponse } from "../_core/types";
import { CITY_REGISTRY } from "../_cities";
import { createSuccessResponse } from "../_core/apiUtils";
import { CACHE_TTL } from "../_core/config";

export async function onRequest() {
    const response: AppCitiesResponse = { 
        cities: Object.values(CITY_REGISTRY).map(city => ({
            slug: city.slug,
            name: city.name,
            country: city.country,
            timezone: city.timezone,
            center: city.center,
            bounds: city.bounds,
            isBeta: city.isBeta,
            isHidden: city.isHidden,
            hasPointsOfSale: city.hasPointsOfSale,
            hasAlerts: city.hasAlerts,
            filters: city.filters,
        }))
    };
    return createSuccessResponse(response, CACHE_TTL.CITIES);
};
