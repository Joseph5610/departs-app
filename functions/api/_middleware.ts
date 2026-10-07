import { createErrorResponse, isAllowedOrigin } from "../_core/apiUtils";

export const onRequest: PagesFunction = async ({ request, next }) => {
    const origin = request.headers.get("Origin");
    const allowed = isAllowedOrigin(origin, request.url);

    if (origin && !allowed) {
        return createErrorResponse("Origin not allowed.", 403);
    }

    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": allowed && origin ? origin : "null",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "3600",
                "Vary": "Origin",
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
        });
    }

    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
        return createErrorResponse("Method not allowed.", 405);
    }

    const response = await next();
    const newResponse = new Response(response.body, response);

    newResponse.headers.set("X-Content-Type-Options", "nosniff");
    newResponse.headers.set("X-Frame-Options", "DENY");
    newResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    if (origin && allowed) {
        newResponse.headers.set("Access-Control-Allow-Origin", origin);
        newResponse.headers.set("Vary", "Origin");
    }

    return newResponse;
};
