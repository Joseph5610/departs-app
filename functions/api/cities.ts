import { Env, AppCitiesResponse } from "../_core/types";
import { CITY_REGISTRY } from "../_core/city-config";
import { createSuccessResponse } from "../_core/api-utils";

export const onRequest: PagesFunction<Env> = async (context) => {
    // Read Flagship value for Brno (fallback to false if missing or error)
    // using catch in case the binding is not yet provided locally
    const isBrnoEnabled = await context.env.FLAGS?.getBooleanValue("city-brno", false).catch(() => false);

    const allCities = Object.values(CITY_REGISTRY).map(city => ({
        slug: city.slug,
        name: city.name,
        center: city.center,
        bounds: city.bounds
    }));
    
    // Filter cities based on flags
    const cities = allCities.filter(city => {
        if (city.slug === 'brno' && !isBrnoEnabled) return false;
        return true;
    });
    
    const response: AppCitiesResponse = { cities };
    return createSuccessResponse(response, 3600); // cache for 1 hour
};

