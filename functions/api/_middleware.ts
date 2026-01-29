export const onRequest: PagesFunction = async ({ request, next }) => {
    const origin = request.headers.get("Origin");

    // Handle Preflight (OPTIONS) requests
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": origin || "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Access-Token",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    // Process the request
    const response = await next();

    // Clone headers so we can modify them
    const headers = new Headers(response.headers);

    if (origin) {
        // If there is an Origin header, reflect it back (safe approach for production)
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Vary", "Origin");
    } else {
        // Fallback for simple requests without Origin
        headers.set("Access-Control-Allow-Origin", "*");
    }

    return new Response(response.body, {
        ...response,
        headers,
    });
};
