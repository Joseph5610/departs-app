import { Env, AppDepartureResponse } from "../../../../_core/types";
import { CACHE_TTL, ERROR_MESSAGES } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GOLEMIO_CONFIG } from "../../core/config";
import { golemioDepartureItemSchema, type GolemioDepartureItem } from "./schemas";

import { z } from "zod";
import { GolemioClient } from "../../core/GolemioClient";
import { DeparturesMapper } from "./DeparturesMapper";
import { departuresQuerySchema, parseSearchParams } from "../../../../_core/schemas";
import { getEnrichmentData } from "../stops/enrichment";

/**
 * Service for fetching and processing real-time departure boards for a specific stop.
 */
export class DeparturesService {
    constructor(private client: GolemioClient) {}

    /**
     * Filters a comma-separated string of stop IDs down to the specific platform nodes (Z-nodes)
     * suitable for querying the departure board API.
     * 
     * PID Domain Logic:
     * - "S" nodes represent Station areas (Parent stations). These are structural and cannot be queried for departures.
     * - "Z" nodes represent specific Platforms (Zastávky). Departures are always attached to platforms.
     * 
     * If a query includes a mix of S and Z nodes, we strip the S nodes to prevent upstream API errors.
     * If no Z nodes exist, we fall back to raw IDs to ensure the query doesn't fail silently.
     * Also strips internal "centroid-" prefixes.
     * 
     * @param stopId The raw stop ID (potentially a comma-separated list of child IDs)
     * @returns Array of filtered platform IDs ready for Golemio API
     */
    private filterStopIdsForDepartures(stopId: string): string[] {
        const cleanStopId = stopId.replace(/^centroid-/, '');
        const rawIds = cleanStopId.split(',');
        const finalIds = rawIds.filter(id => {
            if (id.includes('S')) return false; 
            if (!id.includes('Z')) return false; 
            return true;
        });
        return finalIds.length > 0 ? finalIds : rawIds;
    }

    /**
     * Fetches departures for a given stop, processes and normalizes the data,
     * including deduplicating metro trains and formatting line metadata.
     * 
     * @param {Env} env - The environment configuration
     * @param {URLSearchParams} searchParams - The query parameters containing stop ID and filters
     * @returns {Promise<AppDepartureResponse>} Normalized departures response
     * @throws {ApiError} If stopId is missing or upstream fetch fails
     */
    async getDepartures(env: Env, searchParams: URLSearchParams): Promise<AppDepartureResponse> {
        const enrichmentData = await getEnrichmentData();
        const { stopId: rawStopIds } = parseSearchParams(searchParams, departuresQuerySchema);
        const stopIds = rawStopIds.filter((id): id is string => !!id);

        if (stopIds.length === 0) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

            const stopIdsParams: string[] = [];
            
            stopIds.forEach((id, idx) => {
                const idsToFetch = this.filterStopIdsForDepartures(id);
                const groupObj = { [String(idx)]: idsToFetch };
                stopIdsParams.push(JSON.stringify(groupObj));
            });

            const response = await this.client.fetch("/v2/public/departureboards", env, {
                cacheTtl: CACHE_TTL.DEPARTURES,
                searchParams: {
                    "stopIds[]": stopIdsParams,
                    limit: GOLEMIO_CONFIG.DEPARTURE_LIMIT.toString(),
                    minutesAfter: GOLEMIO_CONFIG.DEPARTURE_MINUTES_AFTER.toString()
                }
            });

            if (!response.ok) {
                const status = (response.status === 404 || response.status === 400) ? response.status : 502;
                throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), status);
            }

            const rawData = await response.json();
            
            // Safe array parsing: if an individual departure item is malformed, 
            // we catch it as null and filter it out, saving the rest of the board!
            const safeSchema = z.array(z.array(golemioDepartureItemSchema.nullable().catch(err => {
                console.warn("Skipping invalid departure item:", err);
                return null;
            })));
            
            const parsed = safeSchema.safeParse(rawData);
            if (!parsed.success) {
                console.error("Critical Golemio structural change:", parsed.error);
                throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(502), 502);
            }
            
            // Filter out the nulls
            const data = parsed.data.map(group => group.filter((item): item is GolemioDepartureItem => item !== null));
            
            return DeparturesMapper.map(data, stopIds, enrichmentData);
    }
}
