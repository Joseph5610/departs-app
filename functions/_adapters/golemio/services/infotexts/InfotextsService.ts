import { Env, AppInfotext } from "../../../../_core/types";
import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GolemioClient } from "../../core/GolemioClient";
import { golemioInfotextSchema } from "./schemas";
import { InfotextsMapper } from "./InfotextsMapper";
import { z } from "zod";

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

            const rawData = await response.json();
            
            // Validate structure with Zod and drop malformed infotexts silently
            const safeArraySchema = z.array(golemioInfotextSchema.nullable().catch(err => {
                console.warn("Skipping invalid Infotext:", err.error);
                return null;
            }));

            const parsed = safeArraySchema.safeParse(rawData);
            if (!parsed.success) {
                console.error("Critical Golemio Infotext structural change:", parsed.error);
                throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(502), 502);
            }

            const data = parsed.data.filter((i): i is NonNullable<typeof i> => i !== null);
            return InfotextsMapper.map(data);
    }
}
