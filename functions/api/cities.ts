import { Env, AppCitiesResponse } from "../_core/types";
import { CITY_REGISTRY } from "../_core/city-config";
import { createSuccessResponse } from "../_core/api-utils";

export const onRequest: PagesFunction<Env> = async (context) => {
    const allCities = Object.values(CITY_REGISTRY).map(city => ({
        slug: city.slug,
        name: city.name,
        center: city.center,
        bounds: city.bounds
    }));
    
    const cities = allCities;
    
    const response: AppCitiesResponse = { cities };
    return createSuccessResponse(response, 3600); // cache for 1 hour
};

