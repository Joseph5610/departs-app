import { Env, AppInfotext } from "../../../../_core/types";
import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GolemioClient } from "../../core/GolemioClient";
import { GolemioInfotext } from "./types";
import { InfotextsMapper } from "./InfotextsMapper";

/**
 * Service for fetching and processing transit infotexts.
 */
export class InfotextsService {
    constructor(private client: GolemioClient) {}

    /**
     * Retrieves the transit infotexts from Golemio API.
     * 
     * @param {Env} env - The Cloudflare worker environment
     * @returns {Promise<AppInfotext[]>} Filtered and normalized infotexts
     */
    async getInfotexts(env: Env): Promise<AppInfotext[]> {
        const response = await this.client.fetch("/v3/pid/infotexts", env, {
                cacheTtl: CACHE_TTL.INFOTEXTS,
                searchParams: {
                    includeFuture: "true"
                }
            });

            if (!response.ok) {
                throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
            }

            try {
                const data: GolemioInfotext[] = await response.json();
                return InfotextsMapper.map(data);
            } catch (e) {
                console.error("InfotextsService: Failed to parse JSON response", e);
                return [];
            }
    }
}
