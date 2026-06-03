import { Env } from "../../../_core/types";
import { CityConfig } from "../../../_core/city-config";
import { ApiError } from "../../../_core/errors";
import { CACHE_TTL } from "../../../_core/api-utils";
import { GOLEMIO_CONFIG } from "./config";

export interface GolemioEnv extends Env {
    GOLEMIO_API_KEY: string;
}

export interface GolemioFetchOptions {
    /** Custom TTL for Cloudflare cache */
    cacheTtl?: number;
    /** Query parameters to append to the request */
    searchParams?: Record<string, string | string[]>;
}

export class GolemioClient {
    constructor(private city: CityConfig) {}

    /**
     * Standardized fetch wrapper for the Golemio API.
     */
    async fetch(
        path: string,
        env: Env,
        options: GolemioFetchOptions = {}
    ): Promise<Response> {
        const baseUrl = GOLEMIO_CONFIG.BASE_URL;
        const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

        if (options.searchParams) {
            Object.entries(options.searchParams).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach(v => url.searchParams.append(key, v));
                } else {
                    url.searchParams.set(key, value);
                }
            });
        }

        const finalUrl = url.toString().replace(/%5B/g, '[').replace(/%5D/g, ']');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        try {
            const golemioEnv = env as GolemioEnv;
            const response = await fetch(finalUrl, {
                headers: {
                    "X-Access-Token": golemioEnv.GOLEMIO_API_KEY,
                    "Content-Type": "application/json",
                },
                cf: {
                    cacheTtl: options.cacheTtl ?? CACHE_TTL.VEHICLES,
                    cacheEverything: true,
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error: unknown) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new ApiError("Golemio API request timed out (15s)", 504, { cause: error });
            }
            throw error;
        }
    }
}
