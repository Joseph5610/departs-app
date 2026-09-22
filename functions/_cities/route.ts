import type { EventContext } from "@cloudflare/workers-types";
import type { CityRequestContext, Env } from "../_core/types";
import type { CityConfig } from "../_core/city-config";
import { createErrorResponse, createJsonBodyResponse, createSuccessResponse, handleError, toCityRequestContext } from "../_core/api-utils";
import type { CityUseCases } from "../_domain/use-cases";
import type { City } from "./types";
import { getCity, useCasesOf } from "./index";

/**
 * Wraps an API route: resolves the city from the path, hands its use-cases to `handler`, and turns
 * the result or a thrown error into a standardized response. `cacheTtl` may depend on the result.
 */
export function withCityRoute<T>(
    handler: (city: CityUseCases, context: CityRequestContext) => Promise<T>,
    cacheTtl: number | ((result: T) => number)
): (context: EventContext<Env, string, unknown>) => Promise<Response> {
    return withCity(async (city, context) => {
        const result = await handler(useCasesOf(city, context.env), toCityRequestContext(context));
        return createSuccessResponse(result, typeof cacheTtl === 'function' ? cacheTtl(result) : cacheTtl);
    });
}

/**
 * `withCityRoute` for handlers that need only the city's config and return an already-serialized JSON body.
 */
export function withCityJsonBodyRoute(
    handler: (city: CityConfig, context: EventContext<Env, string, unknown>) => Promise<BodyInit>,
    cacheTtl: number
): (context: EventContext<Env, string, unknown>) => Promise<Response> {
    return withCity(async (city, context) => createJsonBodyResponse(await handler(city.config, context), cacheTtl));
}

function withCity(
    respond: (city: City, context: EventContext<Env, string, unknown>) => Promise<Response>
): (context: EventContext<Env, string, unknown>) => Promise<Response> {
    return async (context) => {
        const slug = context.params.city as string;

        if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
            return createErrorResponse('Invalid city format', 400);
        }

        const city = getCity(slug);

        if (!city) {
            return createErrorResponse('City not found', 404);
        }

        try {
            return await respond(city, context);
        } catch (error) {
            return handleError(error);
        }
    };
}
