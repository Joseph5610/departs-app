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

    // Handle Preflight (OPTIONS)
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": allowed && origin ? origin : "null",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Access-Token",
                "Access-Control-Max-Age": "86400",
                "Vary": "Origin"
            },
        });
    }

    const response = await next();

    // 2. Add CORS headers to the actual response
    const newResponse = new Response(response.body, response);
    if (allowed && origin) {
        newResponse.headers.set("Access-Control-Allow-Origin", origin);
        newResponse.headers.set("Vary", "Origin");
    }

    return newResponse;
};
