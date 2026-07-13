import { Env } from "../../../_core/types";
import { CACHE_TTL } from "../../../_core/api-utils";
import { GOLEMIO_CONFIG } from "./config";
import { ApiClient, ApiFetchOptions } from "../../../_core/ApiClient";

export interface GolemioEnv extends Env {
    GOLEMIO_API_KEY: string;
}

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
        if (!env) {
            throw new Error("GolemioClient requires env to be passed to fetch for API key.");
        }
        const golemioEnv = env as GolemioEnv;
        
        return this.client.fetch(path, {
            ...options,
            cacheTtl: options.cacheTtl ?? CACHE_TTL.VEHICLES,
            headers: {
                ...options.headers,
                "X-Access-Token": golemioEnv.GOLEMIO_API_KEY,
                "Content-Type": "application/json",
            }
        });
    }
}
