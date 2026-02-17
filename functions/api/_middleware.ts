const ALLOWED_PATTERNS = [
    /^https:\/\/(www\.)?departs\.app$/,      // Main domain (with or without www)
    /^https:\/\/.*departs-app\.pages\.dev$/, // Cloudflare Pages (all environments)
    /^http:\/\/localhost:\d+$/,              // Localhost
    /^http:\/\/127\.0\.0\.1:\d+$/            // Local IP
];

const isAllowedOrigin = (origin: string | null): boolean => {
    if (!origin) return false;
    return ALLOWED_PATTERNS.some(pattern => pattern.test(origin));
};

export const onRequest: PagesFunction = async ({ request, next }) => {
    const origin = request.headers.get("Origin");
    const allowed = isAllowedOrigin(origin);

    // 1. Security check: Block disallowed origins explicitly
    // This prevents other websites from making browser-based requests to the API.
    if (origin && !allowed) {
        return new Response("Forbidden: Origin not allowed", { status: 403 });
    }

    // 2. Handle Preflight (OPTIONS)
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": allowed && origin ? origin : "null",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400",
                "Vary": "Origin"
            },
        });
    }

    // 3. Block disallowed methods (we only use GET for the public API)
    if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const response = await next();

    // 4. Add CORS headers to the actual response for allowed origins
    if (origin && allowed) {
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("Access-Control-Allow-Origin", origin);
        newResponse.headers.set("Vary", "Origin");
        return newResponse;
    }

    return response;
};
