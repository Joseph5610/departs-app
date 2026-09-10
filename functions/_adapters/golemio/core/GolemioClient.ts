import { Env } from "../../../_core/types";
import { CACHE_TTL, ERROR_MESSAGES } from "../../../_core/config";
import { ApiError } from "../../../_core/errors";
import { GOLEMIO_CONFIG } from "./config";
import { ApiClient, ApiFetchOptions } from "../../../_core/ApiClient";

export class GolemioClient {
    private client: ApiClient;

    constructor() {
        this.client = new ApiClient(GOLEMIO_CONFIG.BASE_URL);
    }

    /**
     * Standardized fetch wrapper for the Golemio API.
     */
    async fetch(
        path: string | URL,
        env?: Env,
        options: ApiFetchOptions = {}
    ): Promise<Response> {
        const apiKey = env?.GOLEMIO_API_KEY;
        if (!apiKey) {
            console.error('GOLEMIO_API_KEY is not configured; cannot reach the upstream API.');
            throw new ApiError(ERROR_MESSAGES.GENERIC_INTERNAL, 500);
        }

        return this.client.fetch(path, {
            ...options,
            cacheTtl: options.cacheTtl ?? CACHE_TTL.VEHICLES,
            headers: {
                ...options.headers,
                "X-Access-Token": apiKey,
                "Content-Type": "application/json",
            }
        });
    }
}
