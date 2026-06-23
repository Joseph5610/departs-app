import { isAllowedOrigin } from "../_core/api-utils";

export const onRequest: PagesFunction = async ({ request, next }) => {
    const origin = request.headers.get("Origin");
    const allowed = isAllowedOrigin(origin);

    // 1. Security check: Block disallowed origins explicitly
    if (origin && !allowed) {
        return new Response("Forbidden: Origin not allowed", { status: 403 });
    }

    // 2. Handle Preflight (OPTIONS)
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

    // 3. Block disallowed methods
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
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
