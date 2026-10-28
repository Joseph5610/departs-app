import type { AppCitiesResponse } from "../_core/types";
import { CITY_FACTS } from "../../shared/cities";
import { createSuccessResponse } from "../_core/apiUtils";
import { CACHE_TTL } from "../_core/config";

/** Every city's shared facts; the app bundles them since 0.90.0, this answers installs from before. */
export async function onRequest() {
    const response: AppCitiesResponse = { cities: Object.values(CITY_FACTS) };
    return createSuccessResponse(response, CACHE_TTL.CITIES);
};
