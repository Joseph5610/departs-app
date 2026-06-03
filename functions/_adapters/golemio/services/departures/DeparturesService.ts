import { Env, AppDepartureResponse } from "../../../../_core/types";
import { GolemioDepartureItem } from "./types";
import { CACHE_TTL, ERROR_MESSAGES, sanitizeId } from "../../../../_core/api-utils";
import { ApiError } from "../../../../_core/errors";
import { GOLEMIO_CONFIG } from "../../core/config";
import { GolemioClient } from "../../core/GolemioClient";
import { DeparturesMapper } from "./DeparturesMapper";

/**
 * Service for fetching and processing real-time departure boards for a specific stop.
 */
export class DeparturesService {
    constructor(private client: GolemioClient) {}



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
        let stopIds = searchParams.getAll("stopId").map(sanitizeId).filter((id): id is string => !!id);
        
        if (stopIds.length === 0) {
            const singleStopId = sanitizeId(searchParams.get("stopId"));
            if (singleStopId) {
                stopIds = [singleStopId];
            }
        }

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
                throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), 502);
            }

            const data = await response.json() as GolemioDepartureItem[][];
            return DeparturesMapper.map(data, stopIds);
    }
}
