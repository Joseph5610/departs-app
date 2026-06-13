import type { AppCitiesResponse } from "../_core/types";
import { CITY_REGISTRY } from "../_core/city-config";
import { createSuccessResponse } from "../_core/api-utils";

export async function onRequest() {
    const response: AppCitiesResponse = { cities: Object.values(CITY_REGISTRY) };
    return createSuccessResponse(response, 3600); // cache for 1 hour
};
